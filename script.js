// Game constants and state
const BOARD_SIZE = 19;
// const CELL_SIZE = 30; // No longer used for fixed board/cell pixel dimensions. Retain if needed for other calculations.
                       // For star point positioning, we'll use percentages or derive from container.

// Game settings
let currentGameMode = 'pvai';
let currentAiDifficulty = 'medium';
const humanPlayerColor = 'black';
const aiPlayerColor = 'white';

// Global state variables
let currentPlayer;
let boardState;
let gameEnded = false;
let stonesCapturedByBlack = 0;
let stonesCapturedByWhite = 0;

// DOM elements
let goBoardContainer = null;
let gameModeSelect = null;
let aiDifficultySelect = null;
let aiDifficultySection = null;
let newGameButton = null;
let endGameButton = null;
let gameMessageElement = null;

// Helper function: Get valid neighbors
function getNeighbors(row, col, boardSize) {
    const neighbors = [];
    const deltas = [[-1, 0], [1, 0], [0, -1], [0, 1]]; // Up, Down, Left, Right

    for (const [dr, dc] of deltas) {
        const r = row + dr;
        const c = col + dc;
        if (r >= 0 && r < boardSize && c >= 0 && c < boardSize) {
            neighbors.push([r, c]);
        }
    }
    return neighbors;
}

// Helper function: Find a group of connected stones and its liberties
function findGroup(row, col, board, playerColor) {
    const stones = []; // Array of [r, c] for stones in the group
    const liberties = new Set(); // Set of "r,c" strings for unique liberties
    const visited = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(false));
    const queue = [[row, col]];

    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE || board[row][col] !== playerColor) {
        return { stones: [], liberties: new Set() }; // Should not happen if called correctly
    }

    visited[row][col] = true;
    stones.push([row, col]);

    let head = 0;
    while (head < queue.length) {
        const [currentRow, currentCol] = queue[head++];

        const neighbors = getNeighbors(currentRow, currentCol, BOARD_SIZE);
        for (const [nr, nc] of neighbors) {
            // Explicit boundary check, though getNeighbors should ensure this.
            if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) {
                continue;
            }

            if (board[nr][nc] === null) { // Empty spot - a liberty
                liberties.add(`${nr},${nc}`);
            } else if (board[nr][nc] === playerColor && !visited[nr][nc]) {
                visited[nr][nc] = true;
                stones.push([nr, nc]);
                queue.push([nr, nc]);
            }
        }
    }
    return { stones, liberties };
}


// Pure logic function for placing a stone
function placeStoneLogic(row, col, currentBoard, player) {
    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE || currentBoard[row][col] !== null) {
        return {
            newBoardState: currentBoard,
            newCurrentPlayer: player,
            moveMade: false,
            error: "Invalid move: Spot is out of bounds or already occupied.",
            capturedCoords: []
        };
    }

    let tempBoard = currentBoard.map(arrRow => arrRow.slice());
    tempBoard[row][col] = player; // Tentatively place the stone

    const opponentColor = (player === 'black') ? 'white' : 'black';
    let capturedStonesCount = 0;
    const capturedThisTurn = []; // To store coordinates of stones captured in this move

    // Check opponent groups for capture
    const neighbors = getNeighbors(row, col, BOARD_SIZE);
    for (const [nr, nc] of neighbors) {
        if (tempBoard[nr][nc] === opponentColor) {
            const group = findGroup(nr, nc, tempBoard, opponentColor);
            if (group.liberties.size === 0) {
                for (const [sr, sc] of group.stones) {
                    // Check if already captured in this turn (e.g. part of another group connected to another neighbor)
                    // This check might be redundant if findGroup is called on a board that reflects prior captures in this turn.
                    // For now, assume findGroup is always on the "current state of tempBoard".
                    if (tempBoard[sr][sc] === opponentColor) { // Ensure it hasn't been cleared by a previous group capture this turn
                        tempBoard[sr][sc] = null;
                        capturedThisTurn.push([sr, sc]);
                        capturedStonesCount += 1;
                    }
                }
            }
        }
    }

    // Check placed stone's group for self-capture (suicide)
    const ownGroup = findGroup(row, col, tempBoard, player);
    if (ownGroup.liberties.size === 0) {
        if (capturedStonesCount === 0) { // Simple suicide (no opponent stones captured)
            // Move is invalid, revert the placed stone. Original board is returned.
            return {
                newBoardState: currentBoard, // Return original board
                newCurrentPlayer: player,
                moveMade: false,
                error: "Invalid move: self-capture (suicide) without capturing opponent stones.",
                capturedCoords: []
            };
        } else {
            // Suicide, but opponent stones were captured. The move is valid.
            // The placed stone's group is also removed.
            for (const [sr, sc] of ownGroup.stones) {
                if (tempBoard[sr][sc] === player) { // Ensure it's part of the current player's group
                    tempBoard[sr][sc] = null;
                    // These are not "captured" in the sense of scoring, but removed.
                    // We might need a different list if we want to animate their removal differently.
                    // For now, capturedThisTurn only lists opponent stones.
                }
            }
        }
    }

    const nextPlayer = (player === 'black') ? 'white' : 'black';
    return {
        newBoardState: tempBoard,
        newCurrentPlayer: nextPlayer,
        moveMade: true,
        capturedCoords: capturedThisTurn
    };
}

// Functions that interact with the DOM
function drawStone(row, col, playerColor) {
    if (!goBoardContainer) return; // Don't run in Node.js

    const clickedIntersection = goBoardContainer.querySelector(`.board-intersection[data-row='${row}'][data-col='${col}']`);
    if (!clickedIntersection) return;

    // Clear any existing stone if any (e.g. if styling implies one stone div per intersection)
    // For current approach, just append. If only one stone div is desired:
    // while (clickedIntersection.firstChild) {
    //   clickedIntersection.removeChild(clickedIntersection.firstChild);
    // }
    const stoneElement = document.createElement('div');
    stoneElement.classList.add('stone', playerColor);
    clickedIntersection.appendChild(stoneElement);
}

function handleIntersectionClick(event) {
    if (gameEnded) {
        console.log("Move attempted, but game has ended.");
        if (gameMessageElement) gameMessageElement.textContent = "Game has ended. Press 'Start New Game' to play again.";
        // alert("The game has ended. Please start a new game."); // Alternative
        return;
    }
    if (!goBoardContainer) return;

    const targetCell = event.currentTarget;
    const row = parseInt(targetCell.dataset.row);
    const col = parseInt(targetCell.dataset.col);

    let playerMakingMove = currentPlayer;

    if (currentGameMode === 'pvai' && currentPlayer === aiPlayerColor) {
        console.log("Human clicked, but it's AI's turn. Ignoring.");
        return;
    }
    // In PvP mode, currentPlayer correctly reflects whose turn it is.
    // In PvAI mode, this block is only reached if currentPlayer is humanPlayerColor.

    const result = placeStoneLogic(row, col, boardState, playerMakingMove);

    if (result.moveMade) {
        // const playerWhoPlacedStone = boardState[row][col]; // This would be null
        // The stone color is playerMakingMove
        boardState = result.newBoardState;
        drawStone(row, col, playerMakingMove);

        if (result.capturedCoords && result.capturedCoords.length > 0) {
            const numCaptured = result.capturedCoords.length;
            if (playerMakingMove === humanPlayerColor) { // Assuming human is black for now or based on humanPlayerColor
                if (humanPlayerColor === 'black') stonesCapturedByBlack += numCaptured;
                else stonesCapturedByWhite += numCaptured;
            } else if (playerMakingMove === aiPlayerColor) { // This branch is for PvP if playerMakingMove can be AI
                // This part of handleIntersectionClick is for human moves primarily in PvAI,
                // or any player in PvP.
                // If PvP, playerMakingMove is the current player.
                if (playerMakingMove === 'black') stonesCapturedByBlack += numCaptured;
                else stonesCapturedByWhite += numCaptured;
            }
            console.log(`Player ${playerMakingMove} captured ${numCaptured} stones. Total captured by Black: ${stonesCapturedByBlack}, by White: ${stonesCapturedByWhite}`);
            result.capturedCoords.forEach(coord => removeStoneFromDOM(coord[0], coord[1]));
        }

        console.log(`Stone placed at (${row}, ${col}) by ${playerMakingMove}.`);

        currentPlayer = result.newCurrentPlayer;
        // updateTurnDisplay();

        console.log(`[DEBUG] Human move by ${playerMakingMove} processed. Global currentPlayer is now: ${currentPlayer}. Game mode: ${currentGameMode}. AI color: ${aiPlayerColor}. Human color: ${humanPlayerColor}`);

        // Refined condition:
        if (currentGameMode === 'pvai' &&
            playerMakingMove === humanPlayerColor && // Ensure the move just made was by the human
            currentPlayer === aiPlayerColor) {       // And now it's the AI's turn

            console.log("[DEBUG] AI Trigger: Conditions met. Human made a move, and it's now AI's turn. Calling triggerAIMove via setTimeout.");
            setTimeout(triggerAIMove, 500);

        } else if (currentGameMode === 'pvai' && playerMakingMove === humanPlayerColor && currentPlayer !== aiPlayerColor) {
            // This case means human moved, but it's somehow not AI's turn. This would be unexpected.
            console.warn(`[DEBUG] AI Trigger: Post-human move, but not AI's turn. Current player: ${currentPlayer}. AI Player: ${aiPlayerColor}`);
        } else if (currentGameMode === 'pvai' && playerMakingMove === aiPlayerColor) {
            // This would mean AI is somehow the one making a move through handleIntersectionClick - should not happen.
            console.warn(`[DEBUG] AI Trigger: AI was playerMakingMove in handleIntersectionClick. This is unexpected.`);
        }
    } else {
        console.log(result.error || `Failed to place stone at (${row}, ${col}) by ${playerMakingMove}.`);
    }
}

function triggerAIMove() {
    if (currentGameMode !== 'pvai' || currentPlayer !== aiPlayerColor) {
        return;
    }
    console.log(`[DEBUG] triggerAIMove called. AI Player: ${aiPlayerColor}, Current Difficulty: ${currentAiDifficulty}`);

    let aiMoveCoords;
    if (currentAiDifficulty === 'low') {
        aiMoveCoords = aiMakeRandomMove(boardState, aiPlayerColor);
    } else if (currentAiDifficulty === 'medium') {
        aiMoveCoords = aiMakeHeuristicMove(boardState, aiPlayerColor);
    } // else if (currentAiDifficulty === 'high') { /* Call high difficulty AI */ }
    else { // Default fallback
        console.warn(`Unknown AI difficulty: ${currentAiDifficulty}. Defaulting to random.`);
        aiMoveCoords = aiMakeRandomMove(boardState, aiPlayerColor);
    }
    console.log(`[DEBUG] AI function (${currentAiDifficulty}) proposed move:`, aiMoveCoords);

    if (aiMoveCoords) {
        const [aiRow, aiCol] = aiMoveCoords;
        const aiResult = placeStoneLogic(aiRow, aiCol, boardState, aiPlayerColor);
        console.log(`[DEBUG] placeStoneLogic result for AI's move:`, aiResult);

        if (aiResult.moveMade) {
            const prevPlayerForAIMove = aiPlayerColor;
            boardState = aiResult.newBoardState;

            drawStone(aiRow, aiCol, prevPlayerForAIMove);

            if (aiResult.capturedCoords && aiResult.capturedCoords.length > 0) {
                const numCapturedByAI = aiResult.capturedCoords.length;
                if (aiPlayerColor === 'black') stonesCapturedByBlack += numCapturedByAI;
                else stonesCapturedByWhite += numCapturedByAI;
                console.log(`AI (${aiPlayerColor}) captured ${numCapturedByAI} stones. Total captured by Black: ${stonesCapturedByBlack}, by White: ${stonesCapturedByWhite}`);
                aiResult.capturedCoords.forEach(coord => removeStoneFromDOM(coord[0], coord[1]));
            }
            console.log("AI placed stone at:", aiRow, aiCol);
            currentPlayer = aiResult.newCurrentPlayer;
            console.log(`[DEBUG] AI move successful. Updating boardState and DOM. New current player: ${currentPlayer}`);
            // updateTurnDisplay();

            if (currentGameMode === 'pvai' && currentPlayer !== humanPlayerColor) {
                console.error("Error: Turn did not switch back to human after AI move. Current player:", currentPlayer);
            }
        } else {
            console.error(`AI Error: AI attempted an invalid move: (${aiRow}, ${aiCol}). Error: ${aiResult.error}. Retrying or passing.`);
            // This should ideally not happen if aiMakeRandomMove only picks valid moves.
            // As a fallback, AI could pass or try finding another move. For now, log and let turn pass.
            currentPlayer = humanPlayerColor; // Pass turn back to human
            console.log("AI passes due to invalid move attempt. Next player: " + currentPlayer);
            // updateTurnDisplay();
        }
    } else {
        console.log("AI passes.");
        currentPlayer = humanPlayerColor;
        console.log(`[DEBUG] AI passes. New current player: ${currentPlayer}`);
        // updateTurnDisplay();
    }
    // Potentially check for game end conditions here (e.g., two consecutive passes)
}


function removeStoneFromDOM(row, col) {
    if (typeof document === 'undefined') return; // Don't run in Node.js

    const intersectionCell = goBoardContainer.querySelector(`.board-intersection[data-row='${row}'][data-col='${col}']`);
    if (intersectionCell) {
        const stoneElement = intersectionCell.querySelector('.stone');
        if (stoneElement) {
            intersectionCell.removeChild(stoneElement);
        } else {
            // console.warn(`No stone DOM element found at (${row},${col}) to remove.`);
        }
    } else {
        // console.warn(`No intersection cell DOM element found for (${row},${col}).`);
    }
}

function addStarPoints() {
    if (BOARD_SIZE !== 19 || !goBoardContainer) return;

    // Clear existing star points first
    const existingStarPoints = goBoardContainer.querySelectorAll('.star-point');
    existingStarPoints.forEach(sp => sp.remove());

    const starPointCoordinates = [ // 0-indexed
        { row: 3, col: 3 }, { row: 3, col: 9 }, { row: 3, col: 15 },
        { row: 9, col: 3 }, { row: 9, col: 9 }, { row: 9, col: 15 },
        { row: 15, col: 3 }, { row: 15, col: 9 }, { row: 15, col: 15 }
    ];

    starPointCoordinates.forEach(coord => {
        const star = document.createElement('div');
        star.classList.add('star-point');
        star.style.position = 'absolute'; // CSS should already have this, but good to be sure

        // Calculate position as percentage of container dimensions
        const leftPercent = ((coord.col + 0.5) / BOARD_SIZE) * 100;
        const topPercent = ((coord.row + 0.5) / BOARD_SIZE) * 100;

        star.style.left = `${leftPercent}%`;
        star.style.top = `${topPercent}%`;
        // CSS transform will center the star-point div on this coordinate

        goBoardContainer.appendChild(star);
    });
}

function drawBoard() {
    if (!goBoardContainer) return;

    // Clear only intersection divs if they exist, or all children if simple
    // goBoardContainer.innerHTML = ''; // This removes everything, including star points if they are direct children
                                     // and not re-added *after* intersections.
                                     // For this version, clearBoardDOM() handles stone removal.
                                     // drawBoard() will create intersections. Star points are added in initializeGame.

    // Remove only old intersections to preserve other potential children if any
    const oldIntersections = goBoardContainer.querySelectorAll('.board-intersection');
    oldIntersections.forEach(intersection => intersection.remove());


    goBoardContainer.style.gridTemplateColumns = `repeat(${BOARD_SIZE}, 1fr)`;
    goBoardContainer.style.gridTemplateRows = `repeat(${BOARD_SIZE}, 1fr)`;
    // Width and height are now controlled by CSS (vw/%, max-width, aspect-ratio)
    // No longer set goBoardContainer.style.width and .height here

    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            const cell = document.createElement('div');
            cell.classList.add('board-intersection');
            cell.dataset.row = row;
            cell.dataset.col = col;
            cell.addEventListener('click', handleIntersectionClick);
            goBoardContainer.appendChild(cell);
            // No explicit cell.style.width/height needed, grid 1fr handles it
        }
    }
    // Star points are called from initializeGame after drawBoard typically
}

// Browser-specific execution
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        goBoardContainer = document.getElementById('go-board-container');
        gameModeSelect = document.getElementById('gameModeSelect');
        aiDifficultySelect = document.getElementById('aiDifficultySelect');
        aiDifficultySection = document.getElementById('aiDifficultySection');
        newGameButton = document.getElementById('newGameButton');
        endGameButton = document.getElementById('endGameButton'); // Added
        gameMessageElement = document.getElementById('gameMessage'); // Added


        if (!goBoardContainer || !gameModeSelect || !aiDifficultySelect || !aiDifficultySection || !newGameButton || !endGameButton || !gameMessageElement) {
            console.error("One or more crucial UI elements for game setup not found!");
            // return; // Keep return if critical, or allow partial functionality
        }

        if (gameModeSelect) {
            gameModeSelect.addEventListener('change', () => {
                currentGameMode = gameModeSelect.value;
                updateGameSetupUI();
            });
        }

        if (aiDifficultySelect) {
            aiDifficultySelect.addEventListener('change', () => {
                currentAiDifficulty = aiDifficultySelect.value;
            });
        }

        if (newGameButton) {
            newGameButton.addEventListener('click', initializeGame);
        }

        if (endGameButton) {
            endGameButton.addEventListener('click', handleEndGameButtonClick);
        }

        initializeGame(); // Setup initial game state and board based on defaults

    });
}

function updateGameSetupUI() {
    if (aiDifficultySection) { // Check if element exists
        aiDifficultySection.style.display = (currentGameMode === 'pvai') ? 'flex' : 'none';
    }
}

function clearBoardDOM() {
    if (!goBoardContainer) return;
    const intersections = goBoardContainer.querySelectorAll('.board-intersection');
    intersections.forEach(intersection => {
        // Remove all children (stones, or any other markers if they existed)
        while (intersection.firstChild) {
            intersection.removeChild(intersection.firstChild);
        }
    });
}

function initializeGame() {
    // Read current selections from UI, or use defaults if UI not fully ready
    currentGameMode = gameModeSelect ? gameModeSelect.value : 'pvai';
    currentAiDifficulty = aiDifficultySelect ? aiDifficultySelect.value : 'medium';

    gameEnded = false;
    if (gameMessageElement) gameMessageElement.textContent = '';
    stonesCapturedByBlack = 0; // Reset capture counts
    stonesCapturedByWhite = 0;
    console.log("Game initialized/reset. gameEnded set to false. Capture counts reset.");


    console.log(`Initializing new game: Mode: ${currentGameMode}, Difficulty: ${currentAiDifficulty}`);

    boardState = getInitialBoardState();
    currentPlayer = getInitialCurrentPlayer();

    if (goBoardContainer) {
        clearBoardDOM();
        if (typeof drawBoard === 'function') {
             drawBoard();
        } else {
            console.error("drawBoard function is not defined.");
        }
    } else {
        // This might happen if initializeGame is called before DOMContentLoaded fully resolves goBoardContainer
        console.warn("goBoardContainer not found during initializeGame. Board UI might not be ready.");
    }
    updateGameSetupUI(); // Update visibility of AI difficulty section
    console.log("Game initialized. Current player:", currentPlayer);
    // updateTurnDisplay(); // Placeholder for any UI update showing whose turn
}


// Exports for testing in Node.js
// Global getInitial functions for script top level and export
function getInitialBoardState() {
    return Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
}
function getInitialCurrentPlayer() {
    return humanPlayerColor;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        BOARD_SIZE,
            getInitialBoardState,
            getInitialCurrentPlayer,
            placeStoneLogic,
            getNeighbors,
            findGroup,
            aiMakeRandomMove,
            aiMakeHeuristicMove,
            initializeGame,
            endGame,
            getGameEndedState,
            getTerritoryInfo, // Export new function
            getStonesCapturedByBlack: () => stonesCapturedByBlack,
            getStonesCapturedByWhite: () => stonesCapturedByWhite,
            calculateScores // Export new function
    };
}

// Getter for gameEnded state for testing
function getGameEndedState() {
    return gameEnded;
}

// Encapsulated core "end game" logic
function endGame() {
    if (gameEnded) {
        console.log("endGame called, but game already ended.");
        return false; // Indicate no change in state
    }
    gameEnded = true;
    console.log("Game ended by endGame function. gameEnded set to true.");
    // DOM updates should be handled by the caller/event listener if needed
    return true; // Indicate state changed
}

// Event handler for the End Game button
function handleEndGameButtonClick() {
    if (endGame()) { // Call core logic to set gameEnded = true
        displayEndOfGameResults();
    } else {
        // If endGame() returned false, it means game was already ended.
        // Message should already be displayed or can be re-displayed if needed.
        if (gameMessageElement && !gameMessageElement.textContent.includes("Game Over!")) {
             gameMessageElement.textContent = "Game already ended. Press 'Start New Game' to play again.";
        }
    }
}

function displayEndOfGameResults() {
    console.log("Determining end of game results...");
    if (typeof getTerritoryInfo !== 'function' || typeof calculateScores !== 'function') {
        console.error("Scoring functions not available.");
        if (gameMessageElement) gameMessageElement.textContent = "Error calculating score.";
        return;
    }

    const territoryInfo = getTerritoryInfo(boardState);

    // stonesCapturedByBlack = number of black stones captured by White.
    // stonesCapturedByWhite = number of white stones captured by Black.
    // calculateScores expects: (blackTerritory, whiteTerritory, blackStonesLost, whiteStonesLost, komi)
    const scores = calculateScores(
        territoryInfo.blackTerritory,
        territoryInfo.whiteTerritory,
        stonesCapturedByBlack,  // Black stones lost (captured by White)
        stonesCapturedByWhite,  // White stones lost (captured by Black)
        6.5 // Default Komi
    );

    let winnerMessage;
    if (scores.blackScore > scores.whiteScore) {
        winnerMessage = `Black wins by ${scores.blackScore - scores.whiteScore} points!`;
    } else if (scores.whiteScore > scores.blackScore) {
        winnerMessage = `White wins by ${scores.whiteScore - scores.blackScore} points!`;
    } else {
        winnerMessage = "Draw!";
    }

    const finalMessage = `Game Over!
Black's Score: ${scores.blackScore} (Territory: ${territoryInfo.blackTerritory}, Captures for Black: ${stonesCapturedByWhite})
White's Score: ${scores.whiteScore} (Territory: ${territoryInfo.whiteTerritory}, Captures for White: ${stonesCapturedByBlack}, Komi: 6.5)
Result: ${winnerMessage}`;

    if (gameMessageElement) {
        gameMessageElement.innerText = finalMessage; // Use innerText to preserve line breaks
    } else {
        alert(finalMessage); // Fallback
    }
    console.log(finalMessage);
}


// Basic AI function
function aiMakeRandomMove(currentBoard, playerColor) {
    const validMoves = [];
    if (!currentBoard) { // Should not happen if called correctly
        console.error("AI: currentBoard is undefined or null");
        return null;
    }

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (currentBoard[r] && currentBoard[r][c] === null) { // Check row exists too
                // placeStoneLogic returns the outcome without modifying currentBoard
                const potentialMove = placeStoneLogic(r, c, currentBoard, playerColor);
                if (potentialMove.moveMade) {
                    validMoves.push([r, c]);
                }
            }
        }
    }

    if (validMoves.length > 0) {
        const randomIndex = Math.floor(Math.random() * validMoves.length);
        return validMoves[randomIndex]; // Returns [r, c]
    } else {
        return null; // Indicates AI passes (or no valid moves)
    }
}

// Heuristic AI function
function aiMakeHeuristicMove(currentBoard, playerColor) {
    const captureMoves = [];
    const otherValidMoves = [];

    if (!currentBoard) {
        console.error("AI Heuristic: currentBoard is undefined or null");
        return null;
    }

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (currentBoard[r] && currentBoard[r][c] === null) {
                const potentialMove = placeStoneLogic(r, c, currentBoard, playerColor);
                if (potentialMove.moveMade) {
                    if (potentialMove.capturedCoords && potentialMove.capturedCoords.length > 0) {
                        captureMoves.push([r, c]);
                    } else {
                        otherValidMoves.push([r, c]);
                    }
                }
            }
        }
    }

    if (captureMoves.length > 0) {
        console.log("AI: Choosing from capture moves:", captureMoves);
        const randomIndex = Math.floor(Math.random() * captureMoves.length);
        return captureMoves[randomIndex];
    } else if (otherValidMoves.length > 0) {
        // console.log("AI: Choosing from other valid moves:", otherValidMoves); // Can be very verbose
        const randomIndex = Math.floor(Math.random() * otherValidMoves.length);
        return otherValidMoves[randomIndex];
    } else {
        console.log("AI: No valid moves found, passing.");
        return null; // AI passes
    }
}

function getTerritoryInfo(board) { // board here is expected to be boardState
    let blackTerritory = 0;
    let whiteTerritory = 0;
    let neutralPoints = 0;
    const visited = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(false));

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] === null && !visited[r][c]) {
                const area = [];
                const borderingColors = new Set();
                const queue = [[r, c]];
                visited[r][c] = true;
                let currentPointIndex = 0;
                let isDame = false; // Flag for neutral/dame points

                while (currentPointIndex < queue.length) {
                    const [currR, currC] = queue[currentPointIndex++];
                    area.push([currR, currC]);

                    const neighbors = getNeighbors(currR, currC, BOARD_SIZE);
                    for (const neighbor of neighbors) {
                        const [nR, nC] = neighbor;
                        if (board[nR][nC] === null && !visited[nR][nC]) {
                            visited[nR][nC] = true;
                            queue.push([nR, nC]);
                        } else if (board[nR][nC] !== null) {
                            borderingColors.add(board[nR][nC]);
                        }
                    }
                }

                if (borderingColors.size === 1) {
                    if (borderingColors.has('black')) {
                        blackTerritory += area.length;
                    } else if (borderingColors.has('white')) {
                        whiteTerritory += area.length;
                    }
                } else {
                    // If borderingColors.size is 0 (empty board) or > 1 (dame), it's neutral
                    neutralPoints += area.length;
                }
            }
        }
    }
    console.log(`Territory found - Black: ${blackTerritory}, White: ${whiteTerritory}, Neutral: ${neutralPoints}`);
    return { blackTerritory, whiteTerritory, neutralPoints };
}

function calculateScores(blackTerritory, whiteTerritory, numStonesCapturedByBlack, numStonesCapturedByWhite, komi = 6.5) {
    // Note: stonesCapturedByBlack means stones Black player captured (which are White stones)
    // stonesCapturedByWhite means stones White player captured (which are Black stones)

    // Black's score = Black's territory + White stones Black captured
    const blackScore = blackTerritory + numStonesCapturedByWhite;
    // White's score = White's territory + Black stones White captured + Komi
    const whiteScore = whiteTerritory + numStonesCapturedByBlack + komi;

    console.log(`Calculating scores:`);
    console.log(`  Black: ${blackTerritory} (territory) + ${numStonesCapturedByWhite} (captures) = ${blackScore}`);
    console.log(`  White: ${whiteTerritory} (territory) + ${numStonesCapturedByBlack} (captures) + ${komi} (komi) = ${whiteScore}`);

    return { blackScore, whiteScore };
}
