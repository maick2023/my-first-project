// Game constants and state
const BOARD_SIZE = 19;
const CELL_SIZE = 30; // pixels - used by DOM functions

// These are the global state variables for the browser environment.
// They will be updated by handleIntersectionClick.
let currentPlayer = 'black';
let boardState = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));

// DOM specific elements - these will be null in Node.js environment
let goBoardContainer = null;

// Pure logic function for placing a stone
function placeStoneLogic(row, col, currentBoard, player) {
    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE || currentBoard[row][col] !== null) {
        return {
            newBoardState: currentBoard,
            newCurrentPlayer: player,
            moveMade: false,
            error: "Invalid move: Spot is out of bounds or already occupied."
        };
    }

    // Create a new board state to avoid mutating the input directly
    const newBoard = currentBoard.map(arrRow => arrRow.slice());
    newBoard[row][col] = player;
    const nextPlayer = (player === 'black') ? 'white' : 'black';

    return {
        newBoardState: newBoard,
        newCurrentPlayer: nextPlayer,
        moveMade: true,
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
    if (!goBoardContainer) return; // Don't run in Node.js

    const targetCell = event.currentTarget;
    const row = parseInt(targetCell.dataset.row);
    const col = parseInt(targetCell.dataset.col);

    // Use the pure logic function to determine the outcome of the move
    const result = placeStoneLogic(row, col, boardState, currentPlayer);

    if (result.moveMade) {
        // Update the global game state
        boardState = result.newBoardState;
        currentPlayer = result.newCurrentPlayer;

        // Perform DOM update
        drawStone(row, col, boardState[row][col]); // boardState[row][col] is the player who just moved
        
        console.log(`Stone placed at (${row}, ${col}) by ${boardState[row][col]}. Next player: ${currentPlayer}`);
    } else {
        console.log(result.error || `Failed to place stone at (${row}, ${col}). Spot might be occupied or invalid.`);
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
        if (goBoardContainer) {
                // Reset state for fresh board draw in browser context for the live game
                currentPlayer = 'black'; // Initial player for the live game
                boardState = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)); // Initial board for the live game
            drawBoard();
            console.log('Go board initialized for browser. Current player:', currentPlayer);
        } else {
            console.error('Go board container not found in DOM.');
        }
    });
}

// Exports for testing in Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        BOARD_SIZE,
        getInitialBoardState: () => Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)),
        getInitialCurrentPlayer: () => 'black',
            placeStoneLogic, // Export the new pure function
            // Note: global boardState and currentPlayer are not directly exported for testing initial state logic,
            // as their "initial" values are what the getters provide.
            // The DOM functions like drawStone, handleIntersectionClick, addStarPoints, drawBoard
            // are not exported as they are not meant for direct Node.js testing without DOM mocks.
    };
}
