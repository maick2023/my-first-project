// __tests__/script.test.js
const game = require('../script.js');
const { placeStoneLogic, getInitialBoardState, getInitialCurrentPlayer, BOARD_SIZE } = game; // Destructure for convenience

describe('Board Initialization', () => {
    test('should have correct BOARD_SIZE', () => {
        expect(game.BOARD_SIZE).toBe(19);
    });

    describe('boardState', () => {
        let initialBoardState;

        beforeEach(() => {
            // Fetch a fresh initial state for each test
            initialBoardState = game.getInitialBoardState();
        });

        test('should be a 2D array with BOARD_SIZE rows', () => {
            expect(Array.isArray(initialBoardState)).toBe(true);
            expect(initialBoardState.length).toBe(game.BOARD_SIZE);
        });

        test('each row in boardState should have BOARD_SIZE columns', () => {
            initialBoardState.forEach(row => {
                expect(Array.isArray(row)).toBe(true);
                expect(row.length).toBe(game.BOARD_SIZE);
            });
        });

        test('all cells in initial boardState should be null', () => {
            initialBoardState.forEach(row => {
                row.forEach(cell => {
                    expect(cell).toBeNull();
                });
            });
        });
    });

    describe('currentPlayer', () => {
        test('should be initialized to "black"', () => {
            const initialPlayer = game.getInitialCurrentPlayer();
            expect(initialPlayer).toBe('black');
        });
    });
});

describe('Stone Placement Logic (placeStoneLogic)', () => {
    let currentTestBoard;
    let currentTestPlayer;

    beforeEach(() => {
        currentTestBoard = getInitialBoardState(); // Get a fresh board from script.js
        currentTestPlayer = getInitialCurrentPlayer();     // Start with 'black'
    });

    test('should place a stone on an empty spot and switch player', () => {
        const row = 0, col = 0;
        const result = placeStoneLogic(row, col, currentTestBoard, currentTestPlayer);

        expect(result.moveMade).toBe(true);
        expect(result.newBoardState[row][col]).toBe(currentTestPlayer); // Should be 'black'
        expect(result.newCurrentPlayer).toBe('white');
        expect(result.error).toBeUndefined();
    });

    test('should correctly place a white stone after black moves', () => {
        // First move (black)
        let result = placeStoneLogic(0, 0, currentTestBoard, currentTestPlayer);
        currentTestBoard = result.newBoardState; 
        currentTestPlayer = result.newCurrentPlayer;   // Player is now 'white'

        // Second move (white)
        const row = 0, col = 1;
        result = placeStoneLogic(row, col, currentTestBoard, currentTestPlayer);

        expect(result.moveMade).toBe(true);
        expect(result.newBoardState[row][col]).toBe('white'); 
        expect(result.newCurrentPlayer).toBe('black');      
        expect(result.error).toBeUndefined();
    });

    test('should not place a stone on an occupied spot', () => {
        const row = 0, col = 0;
        // First move (black places at 0,0)
        let result = placeStoneLogic(row, col, currentTestBoard, currentTestPlayer);
        currentTestBoard = result.newBoardState; // Board now has 'black' at [0][0]
        // currentTestPlayer is now 'white', but for this test, let's see what happens if 'black' tries again (or white on black's stone)
        
        // Attempt to place on the same spot (0,0), which is now 'black'
        // Let's assume it's still black's turn trying to place on its own stone (invalid)
        // or white's turn trying to place on black's stone (also invalid by current logic)
        // Update currentTestPlayer to reflect whose turn it is
        currentTestPlayer = result.newCurrentPlayer; // Should be 'white'

        result = placeStoneLogic(row, col, currentTestBoard, currentTestPlayer); // currentTestPlayer is 'white' attempting to move on 'black's stone

        expect(result.moveMade).toBe(false);
        expect(result.newBoardState[row][col]).toBe('black'); // Still black, not overwritten by white
        expect(result.newCurrentPlayer).toBe('white');       // Player ('white') did not switch because move failed
        expect(result.error).toBeDefined();
    });
    
    test('should not place a stone out of bounds (row too low)', () => {
        const result = placeStoneLogic(-1, 0, currentTestBoard, currentTestPlayer);
        expect(result.moveMade).toBe(false);
        expect(result.error).toBeDefined();
    });

    test('should not place a stone out of bounds (col too high)', () => {
        const result = placeStoneLogic(0, BOARD_SIZE, currentTestBoard, currentTestPlayer);
        expect(result.moveMade).toBe(false);
        expect(result.error).toBeDefined();
    });

    test('board state should remain unchanged for other cells when a stone is placed', () => {
        const row = 5, col = 5;
        // Create a deep copy of the specific portion of the initial board for comparison
        const initialBoardCopy = JSON.parse(JSON.stringify(currentTestBoard));

        const result = placeStoneLogic(row, col, currentTestBoard, currentTestPlayer);

        expect(result.moveMade).toBe(true);
        expect(result.newBoardState[row][col]).toBe(currentTestPlayer); // 'black'

        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (r !== row || c !== col) {
                    expect(result.newBoardState[r][c]).toBe(initialBoardCopy[r][c]);
                }
            }
        }
    });
});
