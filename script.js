document.addEventListener('DOMContentLoaded', () => {
    const goBoardContainer = document.getElementById('go-board-container');
    const BOARD_SIZE = 19;
    const CELL_SIZE = 30; // pixels

    let currentPlayer = 'black';
    let boardState = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));

    function drawStone(row, col, playerColor) {
        const clickedIntersection = goBoardContainer.querySelector(`.board-intersection[data-row='${row}'][data-col='${col}']`);
        if (!clickedIntersection) return; // Should not happen

        // Clear any existing stone in this cell first (optional, but good for re-clicking same spot)
        // while (clickedIntersection.firstChild) {
        //    clickedIntersection.removeChild(clickedIntersection.firstChild);
        // }

        const stoneElement = document.createElement('div');
        stoneElement.classList.add('stone', playerColor);
        // CSS handles positioning within the intersection cell
        clickedIntersection.appendChild(stoneElement);
    }

    function handleIntersectionClick(event) {
        const targetCell = event.currentTarget; // Use currentTarget to ensure it's the element with the listener
        const row = parseInt(targetCell.dataset.row);
        const col = parseInt(targetCell.dataset.col);

        // For now, we don't check if the spot is already taken for simplicity in this step
        // A more robust check would be: if (boardState[row][col] !== null) return;
        if (boardState[row][col] !== null) {
            console.log(`Intersection (${row}, ${col}) is already occupied by ${boardState[row][col]}.`);
            return; // Prevent placing stone if already occupied
        }


        boardState[row][col] = currentPlayer;
        drawStone(row, col, currentPlayer);

        currentPlayer = (currentPlayer === 'black') ? 'white' : 'black';
        
        console.log(`Stone placed at (${row}, ${col}) by ${boardState[row][col]}. Next player: ${currentPlayer}`);
    }

    function addStarPoints() {
        const starPointsCoords = [
            { row: 3, col: 3 }, { row: 3, col: 9 }, { row: 3, col: 15 },
            { row: 9, col: 3 }, { row: 9, col: 9 }, { row: 9, col: 15 },
            { row: 15, col: 3 }, { row: 15, col: 9 }, { row: 15, col: 15 }
        ];

        starPointsCoords.forEach(coord => {
            const starPoint = document.createElement('div');
            starPoint.classList.add('star-point');
            starPoint.style.position = 'absolute'; // Ensure star points are positioned relative to container
            starPoint.style.top = `${(coord.row * CELL_SIZE) + (CELL_SIZE / 2)}px`;
            starPoint.style.left = `${(coord.col * CELL_SIZE) + (CELL_SIZE / 2)}px`;
            goBoardContainer.appendChild(starPoint);
        });
    }

    function drawBoard() {
        goBoardContainer.innerHTML = ''; // Clear previous board (e.g., if resizing or restarting)
        
        // Set grid properties for the container
        goBoardContainer.style.gridTemplateColumns = `repeat(${BOARD_SIZE}, ${CELL_SIZE}px)`;
        goBoardContainer.style.gridTemplateRows = `repeat(${BOARD_SIZE}, ${CELL_SIZE}px)`;
        goBoardContainer.style.width = `${BOARD_SIZE * CELL_SIZE}px`;
        goBoardContainer.style.height = `${BOARD_SIZE * CELL_SIZE}px`;

        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                const cell = document.createElement('div');
                cell.classList.add('board-intersection');
                // CSS grid will handle cell sizing based on container's grid definition.
                // Explicitly setting cell size can be redundant if using '1fr' or if CSS handles it.
                // cell.style.width = `${CELL_SIZE}px`; (already 30px in CSS)
                // cell.style.height = `${CELL_SIZE}px`; (already 30px in CSS)
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

    // Initial setup
    drawBoard();
    console.log('Go board initialized. Current player:', currentPlayer);
    // console.log('Board state:', boardState); // boardState is logged on each click now
});
