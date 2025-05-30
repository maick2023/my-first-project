// Game constants and state
const BOARD_SIZE = 19;
const CELL_SIZE = 30; // pixels - used by DOM functions

// Game settings
let currentGameMode = 'pvai'; 
let currentAiDifficulty = 'medium';
const humanPlayerColor = 'black'; 
const aiPlayerColor = 'white';

// Global state variables
let currentPlayer; 
let boardState; 

// DOM elements
let goBoardContainer = null;
let gameModeSelect = null;
let aiDifficultySelect = null;
let aiDifficultySection = null;
let newGameButton = null;

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
            console.log(`${playerMakingMove} captured stones at:`, result.capturedCoords);
            result.capturedCoords.forEach(coord => removeStoneFromDOM(coord[0], coord[1]));
        }
        
        console.log(`Stone placed at (${row}, ${col}) by ${playerMakingMove}.`);
        
        currentPlayer = result.newCurrentPlayer;
        console.log(`Next player: ${currentPlayer}`);
        // updateTurnDisplay(); 

        if (currentGameMode === 'pvai' && currentPlayer === aiPlayerColor) {
            setTimeout(triggerAIMove, 500); 
        }
    } else {
        console.log(result.error || `Failed to place stone at (${row}, ${col}) by ${playerMakingMove}.`);
    }
}

function triggerAIMove() {
    if (currentGameMode !== 'pvai' || currentPlayer !== aiPlayerColor) {
        return; 
    }

    console.log(`AI's turn (${aiPlayerColor}), Difficulty: ${currentAiDifficulty}`);
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

    if (aiMoveCoords) { 
        const [aiRow, aiCol] = aiMoveCoords;
        const aiResult = placeStoneLogic(aiRow, aiCol, boardState, aiPlayerColor);

        if (aiResult.moveMade) {
            const prevPlayerForAIMove = aiPlayerColor; // AI is making the move
            boardState = aiResult.newBoardState;
            
            drawStone(aiRow, aiCol, prevPlayerForAIMove); // Draw AI's stone (it's aiPlayerColor)
            
            if (aiResult.capturedCoords && aiResult.capturedCoords.length > 0) {
                console.log("AI captured stones at:", aiResult.capturedCoords);
                aiResult.capturedCoords.forEach(coord => removeStoneFromDOM(coord[0], coord[1]));
            }
            console.log("AI placed stone at:", aiRow, aiCol);

            currentPlayer = aiResult.newCurrentPlayer; // Should switch back to human
            console.log(`Next player: ${currentPlayer}`);
            // updateTurnDisplay(); 

            if (gameMode === 'pvai' && currentPlayer !== humanPlayerColor) {
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
        currentPlayer = humanPlayerColor; // Switch turn back to human
        console.log(`Next player: ${currentPlayer}`);
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
    if (!goBoardContainer) return; // Don't run in Node.js

    const starPointsCoords = [
        { row: 3, col: 3 }, { row: 3, col: 9 }, { row: 3, col: 15 },
        { row: 9, col: 3 }, { row: 9, col: 9 }, { row: 9, col: 15 },
        { row: 15, col: 3 }, { row: 15, col: 9 }, { row: 15, col: 15 }
    ];

    starPointsCoords.forEach(coord => {
        const starPoint = document.createElement('div');
        starPoint.classList.add('star-point');
        starPoint.style.position = 'absolute';
        starPoint.style.top = `${(coord.row * CELL_SIZE) + (CELL_SIZE / 2)}px`;
        starPoint.style.left = `${(coord.col * CELL_SIZE) + (CELL_SIZE / 2)}px`;
        goBoardContainer.appendChild(starPoint);
    });
}

function drawBoard() {
    if (!goBoardContainer) return; // Don't run in Node.js

    goBoardContainer.innerHTML = ''; 
    
    goBoardContainer.style.gridTemplateColumns = `repeat(${BOARD_SIZE}, ${CELL_SIZE}px)`;
    goBoardContainer.style.gridTemplateRows = `repeat(${BOARD_SIZE}, ${CELL_SIZE}px)`;
    goBoardContainer.style.width = `${BOARD_SIZE * CELL_SIZE}px`;
    goBoardContainer.style.height = `${BOARD_SIZE * CELL_SIZE}px`;

    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            const cell = document.createElement('div');
            cell.classList.add('board-intersection');
            cell.dataset.row = row;
            cell.dataset.col = col;
            cell.addEventListener('click', handleIntersectionClick);
            goBoardContainer.appendChild(cell);
        }
    }

    if (BOARD_SIZE === 19) {
        addStarPoints();
    }
}

// Browser-specific execution
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        goBoardContainer = document.getElementById('go-board-container');
        gameModeSelect = document.getElementById('gameModeSelect');
        aiDifficultySelect = document.getElementById('aiDifficultySelect');
        aiDifficultySection = document.getElementById('aiDifficultySection');
        newGameButton = document.getElementById('newGameButton');

        if (!goBoardContainer || !gameModeSelect || !aiDifficultySelect || !aiDifficultySection || !newGameButton) {
            console.error("One or more crucial UI elements for game setup not found!");
            return;
        }
        
        gameModeSelect.addEventListener('change', () => {
            currentGameMode = gameModeSelect.value;
            updateGameSetupUI();
            // Optionally, could auto-start a new game or just update setting for next new game.
            // For now, changing mode only affects UI until "New Game" is pressed.
        });
        
        aiDifficultySelect.addEventListener('change', () => {
            currentAiDifficulty = aiDifficultySelect.value;
        });
        
        newGameButton.addEventListener('click', initializeGame);

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

    console.log(`Initializing new game: Mode: ${currentGameMode}, Difficulty: ${currentAiDifficulty}`);

    boardState = getInitialBoardState(); // Defined below for Node.js and browser scope
    currentPlayer = getInitialCurrentPlayer(); // Defined below, returns humanPlayerColor

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
            getInitialBoardState, // Export if it's defined locally here
            getInitialCurrentPlayer, // Export if it's defined locally here
            placeStoneLogic,
            getNeighbors, 
            findGroup,    
            aiMakeRandomMove,
            aiMakeHeuristicMove, // Export the new heuristic AI function
    };
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
