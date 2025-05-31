// __tests__/script.test.js
const game = require('../script.js');
const {
    placeStoneLogic,
    getInitialBoardState,
    getInitialCurrentPlayer,
    BOARD_SIZE,
    getNeighbors,
    findGroup,
    aiMakeRandomMove,
    initializeGame,
    endGame,
    getGameEndedState,
    calculateScores, // Added for Score Calculation tests
    getTerritoryInfo // Added for Territory Counting tests
} = game;

describe('Board Initialization', () => {
    test('should have correct BOARD_SIZE', () => {
        expect(game.BOARD_SIZE).toBe(19);
    });

    describe('boardState', () => {
        let initialBoardState;
        beforeEach(() => {
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

describe('Score Calculation (calculateScores)', () => {
    test('should correctly calculate scores with no territory, captures, or komi (if komi is 0)', () => {
        expect(calculateScores(0, 0, 0, 0, 0)).toEqual({ blackScore: 0, whiteScore: 0 });
    });

    test('should correctly calculate scores with territory and captures, default komi', () => {
        // Black: 10 terr + 3 (white stones captured by black) = 13
        // White: 5 terr + 2 (black stones captured by white) + 6.5 komi = 13.5
        expect(calculateScores(10, 5, 2, 3, 6.5)).toEqual({ blackScore: 13, whiteScore: 13.5 });
    });

    test('should handle zero captures', () => {
        expect(calculateScores(10, 5, 0, 0, 6.5)).toEqual({ blackScore: 10, whiteScore: 11.5 });
    });

    test('should handle zero territory', () => {
        expect(calculateScores(0, 0, 2, 3, 6.5)).toEqual({ blackScore: 3, whiteScore: 8.5 });
    });

    test('should apply komi correctly to white', () => {
        expect(calculateScores(0, 0, 0, 0, 7.5).whiteScore).toBe(7.5);
        expect(calculateScores(10, 10, 0, 0, 0).blackScore).toBe(10);
        expect(calculateScores(10, 10, 0, 0, 0).whiteScore).toBe(10);
    });
});

describe('Territory Counting (getTerritoryInfo)', () => {
    let board;

    // Helper to set stones, assumes board is available in the scope
    const setStonesOnBoard = (stonesToSet) => {
        stonesToSet.forEach(({ r, c, color }) => {
            if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
                board[r][c] = color;
            }
        });
    };

    beforeEach(() => {
        board = getInitialBoardState(); // Creates a BOARD_SIZE x BOARD_SIZE null-filled board
    });

    test('should count all points as neutral on an empty board', () => {
        const result = getTerritoryInfo(board);
        expect(result.blackTerritory).toBe(0);
        expect(result.whiteTerritory).toBe(0);
        expect(result.neutralPoints).toBe(BOARD_SIZE * BOARD_SIZE);
    });

    test('should count no territory or neutral points on a full board', () => {
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                board[r][c] = 'black'; // Fill with one color
            }
        }
        const result = getTerritoryInfo(board);
        expect(result.blackTerritory).toBe(0);
        expect(result.whiteTerritory).toBe(0);
        expect(result.neutralPoints).toBe(0); // No empty points
    });

    test('should correctly count simple enclosed black territory (3x3 empty area)', () => {
        // B B B B B  (0,0 to 0,4) and (4,0 to 4,4)
        // B . . . B  (1,0), (1,4)
        // B . . . B  (2,0), (2,4)
        // B . . . B  (3,0), (3,4)
        // B B B B B
        // Creates a 3x3 empty area (9 points)
        if (BOARD_SIZE < 5) return;
        // Wall of black stones
        for (let i = 0; i < 5; i++) {
            board[0][i] = 'black'; board[4][i] = 'black';
            board[i][0] = 'black'; board[i][4] = 'black';
        }
        // Fill rest of the board with white stones to isolate the black territory
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (board[r][c] === null &&
                    !((r > 0 && r < 4) && (c > 0 && c < 4))) { // If not in the 3x3 empty area
                    board[r][c] = 'white';
                }
            }
        }
        const result = getTerritoryInfo(board);
        expect(result.blackTerritory).toBe(9);
        expect(result.whiteTerritory).toBe(0);
        expect(result.neutralPoints).toBe(0); // All other points are filled with white stones
    });

    test('should correctly count simple white territory (2x2 empty area)', () => {
        // Creates a 2x2 empty area (4 points)
        if (BOARD_SIZE < 4) return;
        for (let i = 0; i < 4; i++) {
            board[0][i] = 'white'; board[3][i] = 'white';
            board[i][0] = 'white'; board[i][3] = 'white';
        }
        // Fill rest of the board with black stones
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (board[r][c] === null &&
                    !((r > 0 && r < 3) && (c > 0 && c < 3))) { // If not in 2x2 empty area
                    board[r][c] = 'black';
                }
            }
        }
        const result = getTerritoryInfo(board);
        expect(result.whiteTerritory).toBe(4);
        expect(result.blackTerritory).toBe(0);
        expect(result.neutralPoints).toBe(0); // All other points are filled with black stones
    });

    test('should correctly identify dame points (3 neutral points, isolated)', () => {
        if (BOARD_SIZE < 3) return;
        // B . W
        // B . W
        // B . W
        // Fill entire board with alternating colors to make this specific dame clear
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (c === 0) board[r][c] = 'black';
                else if (c === 2) board[r][c] = 'white';
                else if (c === 1 && r < 3) board[r][c] = null; // The dame column for first 3 rows
                else board[r][c] = (c % 2 === 0) ? 'black' : 'white'; // Fill rest predictably
            }
        }
        // Explicitly set the dame structure
        board[0][0] = 'black'; board[1][0] = 'black'; board[2][0] = 'black';
        board[0][1] = null;    board[1][1] = null;    board[2][1] = null; // Dame
        board[0][2] = 'white'; board[1][2] = 'white'; board[2][2] = 'white';

        const result = getTerritoryInfo(board);
        // In this specific setup, the 3 null points are dame.
        // All other points are stones. So, no other territory.
        expect(result.neutralPoints).toBe(3);
        expect(result.blackTerritory).toBe(0);
        expect(result.whiteTerritory).toBe(0);
    });

    test('territory on edge/corner (black 1x1 territory in corner 0,0)', () => {
        if (BOARD_SIZE < 2) return;
        // B B
        // B . (0,0 is surrounded by B and edge)
        board[0][1] = 'black';
        board[1][0] = 'black';
        board[1][1] = 'black'; // Make it more solid
        // Fill rest of board with white
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (board[r][c] === null && (r !== 0 || c !== 0) ) {
                    board[r][c] = 'white';
                }
            }
        }
        const result = getTerritoryInfo(board);
        expect(result.blackTerritory).toBe(1);
        expect(result.whiteTerritory).toBe(0); // All other cells are white STONES, not empty white territory
        expect(result.neutralPoints).toBe(0);
    });
});

describe('End Game Logic', () => {
    // initializeGame is imported and should reset gameEnded
    // endGame is imported to trigger the game end
    // getGameEndedState is imported to check the status

    beforeEach(() => {
        // Ensure a fresh state for each test, especially for gameEnded
        initializeGame(); // This should set gameEnded to false
    });

    test('initializeGame should set gameEnded to false', () => {
        // initializeGame is called in beforeEach, so gameEnded should be false
        expect(getGameEndedState()).toBe(false);
        // Call it again just to be explicit for this test's purpose
        initializeGame();
        expect(getGameEndedState()).toBe(false);
    });

    test('endGame should set gameEnded to true', () => {
        expect(getGameEndedState()).toBe(false); // Pre-condition
        const stateChanged = endGame();
        expect(stateChanged).toBe(true); // endGame should indicate it changed the state
        expect(getGameEndedState()).toBe(true);
    });

    test('endGame should be idempotent (calling it again does not change state, returns false)', () => {
        endGame(); // gameEnded is now true
        expect(getGameEndedState()).toBe(true);

        const stateChangedAgain = endGame(); // Call again
        expect(stateChangedAgain).toBe(false); // endGame should indicate state did not change
        expect(getGameEndedState()).toBe(true); // Should remain true
    });

    test('moves should be prevented if gameEnded is true (conceptual check on state)', () => {
        // This test relies on the fact that handleIntersectionClick checks gameEnded.
        // We are testing the *state* that handleIntersectionClick uses.
        endGame(); // End the game
        expect(getGameEndedState()).toBe(true);
        // At this point, if handleIntersectionClick were called, it should see gameEnded as true
        // and prevent a move. We don't directly test handleIntersectionClick here due to DOM dependency,
        // but confirm the state it relies on is correctly set.
    });
});

describe('Stone Placement Logic (placeStoneLogic) - Basic', () => {
    let currentTestBoard;
    let currentTestPlayer;
    beforeEach(() => {
        currentTestBoard = getInitialBoardState();
        currentTestPlayer = getInitialCurrentPlayer();
    });
    test('should place a stone on an empty spot and switch player', () => {
        const row = 0, col = 0;
        const result = placeStoneLogic(row, col, currentTestBoard, currentTestPlayer);
        expect(result.moveMade).toBe(true);
        expect(result.newBoardState[row][col]).toBe(currentTestPlayer);
        expect(result.newCurrentPlayer).toBe('white');
        expect(result.error).toBeUndefined();
    });
    test('should correctly place a white stone after black moves', () => {
        let result = placeStoneLogic(0, 0, currentTestBoard, currentTestPlayer);
        currentTestBoard = result.newBoardState;
        currentTestPlayer = result.newCurrentPlayer;
        const row = 0, col = 1;
        result = placeStoneLogic(row, col, currentTestBoard, currentTestPlayer);
        expect(result.moveMade).toBe(true);
        expect(result.newBoardState[row][col]).toBe('white');
        expect(result.newCurrentPlayer).toBe('black');
        expect(result.error).toBeUndefined();
    });
    test('should not place a stone on an occupied spot (basic check)', () => {
        let result = placeStoneLogic(0, 0, currentTestBoard, currentTestPlayer);
        currentTestBoard = result.newBoardState;
        currentTestPlayer = result.newCurrentPlayer; // Now 'white'
        result = placeStoneLogic(0, 0, currentTestBoard, currentTestPlayer);
        expect(result.moveMade).toBe(false);
        expect(result.newBoardState[0][0]).toBe('black');
        expect(result.newCurrentPlayer).toBe('white');
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
        const initialBoardCopy = JSON.parse(JSON.stringify(currentTestBoard));
        const result = placeStoneLogic(row, col, currentTestBoard, currentTestPlayer);
        expect(result.moveMade).toBe(true);
        expect(result.newBoardState[row][col]).toBe(currentTestPlayer);
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (r !== row || c !== col) {
                    expect(result.newBoardState[r][c]).toBe(initialBoardCopy[r][c]);
                }
            }
        }
    });
});

describe('getNeighbors', () => {
    test('should return 2 neighbors for corner (0,0)', () => {
        const neighbors = getNeighbors(0, 0, BOARD_SIZE);
        expect(neighbors.length).toBe(2);
        expect(neighbors).toEqual(expect.arrayContaining([[1, 0], [0, 1]]));
    });
    test('should return 3 neighbors for edge (0,5)', () => {
        const neighbors = getNeighbors(0, 5, BOARD_SIZE);
        expect(neighbors.length).toBe(3);
        expect(neighbors).toEqual(expect.arrayContaining([[1, 5], [0, 4], [0, 6]]));
    });
    test('should return 4 neighbors for center (5,5)', () => {
        const neighbors = getNeighbors(5, 5, BOARD_SIZE);
        expect(neighbors.length).toBe(4);
        expect(neighbors).toEqual(expect.arrayContaining([[4, 5], [6, 5], [5, 4], [5, 6]]));
    });
    test('should return 2 neighbors for corner (18,18)', () => {
        const neighbors = getNeighbors(BOARD_SIZE - 1, BOARD_SIZE - 1, BOARD_SIZE);
        expect(neighbors.length).toBe(2);
        expect(neighbors).toEqual(expect.arrayContaining([[BOARD_SIZE - 2, BOARD_SIZE - 1], [BOARD_SIZE - 1, BOARD_SIZE - 2]]));
    });
});

describe('findGroup', () => {
    let testBoard;
    beforeEach(() => {
        testBoard = getInitialBoardState(); // Standard 19x19 board
    });

    test('single stone with 4 liberties', () => {
        testBoard[1][1] = 'black';
        const group = findGroup(1, 1, testBoard, 'black');
        expect(group.stones).toEqual(expect.arrayContaining([[1, 1]]));
        expect(group.stones.length).toBe(1);
        expect(group.liberties.size).toBe(4);
        expect([...group.liberties]).toEqual(expect.arrayContaining(['0,1', '2,1', '1,0', '1,2']));
    });

    test('small L-shaped group with 6 liberties', () => {
        testBoard[0][1] = 'black';
        testBoard[1][1] = 'black';
        testBoard[1][0] = 'black';
        // Liberties: (0,0), (0,2), (1,2), (2,1), (2,0), (0,1)->(NONE, already stone), (1,1)->(NONE), (1,0)->(NONE)
        // (0,1) -> (0,0), (0,2), (N/A 1,1)
        // (1,1) -> (0,1-S), (1,0-S), (1,2), (2,1)
        // (1,0) -> (0,0), (1,1-S), (2,0)
        // Unique: (0,0), (0,2), (1,2), (2,1), (2,0) = 5. Wait, (0,1) has neighbor (0,0), (1,1) has (2,1) & (1,2), (1,0) has (0,0) & (2,0)
        // (0,1) libs: (0,0), (0,2)
        // (1,1) libs: (1,2), (2,1)
        // (1,0) libs: (0,0) (already listed), (2,0)
        // Total = (0,0), (0,2), (1,2), (2,1), (2,0) - 5 libs
        const group = findGroup(0, 1, testBoard, 'black');
        expect(group.stones.length).toBe(3);
        expect(group.stones).toEqual(expect.arrayContaining([[0, 1], [1, 1], [1, 0]]));
        expect(group.liberties.size).toBe(5);
        expect([...group.liberties]).toEqual(expect.arrayContaining(['0,0', '0,2', '1,2', '2,1', '2,0']));
    });

    test('group with zero liberties (surrounded)', () => {
        testBoard[1][1] = 'black';
        testBoard[0][1] = 'white';
        testBoard[2][1] = 'white';
        testBoard[1][0] = 'white';
        testBoard[1][2] = 'white';
        const group = findGroup(1, 1, testBoard, 'black');
        expect(group.stones).toEqual(expect.arrayContaining([[1, 1]]));
        expect(group.liberties.size).toBe(0);
    });

    test('group along an edge (top edge, 2 stones)', () => {
        testBoard[0][0] = 'black';
        testBoard[0][1] = 'black';
        // Libs: (0,2), (1,0), (1,1)
        const group = findGroup(0, 0, testBoard, 'black');
        expect(group.stones.length).toBe(2);
        expect(group.stones).toEqual(expect.arrayContaining([[0,0], [0,1]]));
        expect(group.liberties.size).toBe(3);
        expect([...group.liberties]).toEqual(expect.arrayContaining(['0,2', '1,0', '1,1']));
    });

    test('calling on empty cell', () => {
        const group = findGroup(0, 0, testBoard, 'black');
        expect(group.stones.length).toBe(0);
        expect(group.liberties.size).toBe(0);
    });

    test('calling on cell of wrong color', () => {
        testBoard[0][0] = 'white';
        const group = findGroup(0, 0, testBoard, 'black');
        expect(group.stones.length).toBe(0);
        expect(group.liberties.size).toBe(0);
    });
});

describe('placeStoneLogic - Captures and Suicide', () => {
    let board;
    let player;

    beforeEach(() => {
        board = getInitialBoardState();
        player = 'black'; // Black always starts
    });

    // Helper to quickly set stones for tests
    const setStones = (stonesToSet) => {
        stonesToSet.forEach(({r, c, color}) => {
            if (r >=0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
                board[r][c] = color;
            }
        });
    };

    test('simple single stone capture', () => {
        // Test: Simple single stone capture.
        // Board:
        // Test: Simple single stone capture.
        // Board:
        // B B B
        // B W B  (W at (1,1) is white, to be captured)
        // B B B
        // Player 'black' plays at (0,1) - this was the previous setup.
        // Corrected: Player 'black' plays at X, e.g. (0,1) to capture W(1,1)
        // . X .
        // B W B
        // . B .
        board = getInitialBoardState(); // Ensure clean board
        setStones([
            // The stone to be captured and its immediate fixed environment for the test
            {r:1,c:1, color:'white'}, // W - the stone to be captured
            {r:1,c:0, color:'black'}, // B - left of W
            {r:1,c:2, color:'black'}, // B - right of W
            {r:2,c:1, color:'black'}, // B - below W
            // Ensure other relevant neighbors are null or defined if part of test
            {r:0,c:0, color:null}, {r:0,c:2, color:null},
        ]);
        player = 'black';
        // Player 'black' plays at (0,1) (Above W), completing the capture.
        const result = placeStoneLogic(0, 1, board, player);

        expect(result.error).toBeUndefined();
        expect(result.moveMade).toBe(true);      // <<< This was failing (true expected, false received)
        expect(result.newBoardState[0][1]).toBe('black');
        expect(result.newBoardState[1][1]).toBeNull();
        expect(result.capturedCoords).toEqual(expect.arrayContaining([[1,1]]));
        expect(result.capturedCoords.length).toBe(1);
    });

    test('group capture (2 stones)', () => {
        // B B B B
        // B W W B  (White stones at (1,1) and (1,2) to be captured)
        // B . . B  (Black plays at (2,1), assumes (2,2) is already black or will be played by black)
        // B B B B
        setStones([
            {r:0,c:0, color:'black'},{r:0,c:1, color:'black'},{r:0,c:2, color:'black'},{r:0,c:3, color:'black'},
            {r:1,c:0, color:'black'},{r:1,c:1, color:'white'},{r:1,c:2, color:'white'},{r:1,c:3, color:'black'},
            {r:2,c:0, color:'black'},                                                 {r:2,c:3, color:'black'},
            {r:3,c:0, color:'black'},{r:3,c:1, color:'black'},{r:3,c:2, color:'black'},{r:3,c:3, color:'black'},
        ]);
        // Pre-fill one of the capture points for the group
        board[2][2] = 'black';
        // Player 'black' plays at (2,1), which is the last liberty for the white group (1,1)-(1,2)
        const result = placeStoneLogic(2, 1, board, 'black');

        expect(result.moveMade).toBe(true);
        expect(result.newBoardState[2][1]).toBe('black'); // Player's stone
        expect(result.newBoardState[1][1]).toBeNull(); // Captured
        expect(result.newBoardState[1][2]).toBeNull(); // Captured
        expect(result.capturedCoords.length).toBe(2);
        expect(result.capturedCoords).toEqual(expect.arrayContaining([[1,1], [1,2]]));
    });


    test('no capture', () => {
        const result = placeStoneLogic(0, 0, board, 'black'); // Black plays in an empty area
        expect(result.moveMade).toBe(true);
        expect(result.capturedCoords.length).toBe(0);
    });

    test('invalid suicide (no capture)', () => {
        // . W .
        // W . W
        // . W .
        // Black attempts to play at (1,1) - results in suicide as it has no liberties and captures nothing.
        setStones([
            {r:0, c:1, color:'white'},
            {r:1, c:0, color:'white'}, {r:1, c:2, color:'white'},
            {r:2, c:1, color:'white'}
        ]);
        const result = placeStoneLogic(1, 1, board, 'black'); // Black plays at (1,1)
        expect(result.moveMade).toBe(false);
        expect(result.error).toContain('self-capture');
        expect(result.newBoardState[1][1]).toBeNull(); // Stone should not be on the board returned (original board)
    });

    test('valid suicide (captures opponent stones - snapback)', () => {
        // B . B
        // B W B   (W is at (1,1), white stone to be captured)
        // B X B   (Player black plays X at (2,1))
        // This captures W(1,1). The group B(2,1) should survive if it has other liberties.
        // For valid suicide (snapback), the B(2,1) group must die.
        // Revised setup: Black plays at (0,1). Captures W(1,1). Black group (0,1)-(0,0) dies.
        // . W .      (W at (0,1) to provide a boundary)
        // W X W      (W at (1,0), (1,2) to provide boundary)
        // B W B      (B at (2,0) is existing black stone, W at (2,1) is target, B at (2,2) is boundary)
        // Player 'black' (X) plays at (1,1), captures W at (2,1).
        // Black group X(1,1)-B(2,0) dies.
        // This setup was problematic, removing it to prevent confusion and the 'result' redeclaration.
        // player = 'black'; // player is already 'black' from beforeEach or previous assignment in this block
        // const result = placeStoneLogic(1, 1, board, player); // First const result
        // expect(result.moveMade).toBe(true);
        // expect(result.newBoardState[2][1]).toBeNull();
        // expect(result.capturedCoords).toEqual(expect.arrayContaining([[2,1]]));

        // Using the setup intended for the final version of this test:
        // Player P, Opponent O
        // Test "valid suicide" (captures opponent, then self-group is removed OR REMAINS if liberty opened).
        // Current logic: self-group remains if capture opens a liberty.
        // Setup: Black plays X at (0,1). This captures White O at (0,0).
        // The group X(0,1)-B(1,0) should survive because capturing O creates a liberty at (0,0).
        // O X W  (O=(0,0)W, X=(0,1)B-played, W=(0,2)W seals X if (0,0) wasn't a new liberty)
        // B W .  (B=(1,0)B, W=(1,1)W seals X and B)
        // W . .  (W=(2,0)W seals B)
        board = getInitialBoardState(); // Ensure clean board
        setStones([
            {r:0,c:0, color:'white'}, // O - Opponent to be captured
            {r:1,c:0, color:'black'}, // B - Existing stone of player's group
            // White stones to make the X-B group otherwise surrounded
            {r:0,c:2, color:'white'}, // Seals X from right
            {r:1,c:1, color:'white'}, // Seals X from below, B from right
            {r:2,c:0, color:'white'},  // Seals B from below
            {r:2,c:1, color:'white'} // Additional seal for B's potential liberty if X was not there
        ]);
        player = 'black';
        board[0][1] = null; // Ensure X's spot (0,1) is clear for playing
        expect(board[0][1]).toBeNull();
        const result = placeStoneLogic(0, 1, board, player); // X played at (0,1)

        expect(result.error).toBeUndefined();
        expect(result.moveMade).toBe(true);
        expect(result.newBoardState[0][0]).toBeNull(); // O captured
        expect(result.capturedCoords).toEqual(expect.arrayContaining([[0,0]]));
        // X and B survive because (0,0) became a liberty for their group
        expect(result.newBoardState[0][1]).toBe('black'); // X (played stone) remains
        expect(result.newBoardState[1][0]).toBe('black'); // B remains
    });
});

describe('AI Logic (aiMakeRandomMove)', () => {
    let board;

    beforeEach(() => {
        board = getInitialBoardState();
    });

    test('AI picks a valid move on an empty board (black)', () => {
        const move = aiMakeRandomMove(board, 'black');
        expect(move).not.toBeNull();
        expect(Array.isArray(move)).toBe(true);
        expect(move.length).toBe(2);
        const [r, c] = move;
        expect(r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE).toBe(true);
        expect(board[r][c]).toBeNull(); // Spot must have been empty

        const moveValidation = placeStoneLogic(r, c, board, 'black');
        expect(moveValidation.moveMade).toBe(true);
        expect(moveValidation.error).toBeUndefined();
    });

    test('AI picks a valid move on a partially filled board (white)', () => {
        // Setup a simple board
        board[0][0] = 'black';
        board[0][1] = 'black';
        board[1][1] = 'black';
        // (0,2) is empty and valid for white
        // (1,0) is empty and valid for white

        const move = aiMakeRandomMove(board, 'white');
        expect(move).not.toBeNull();
        expect(Array.isArray(move)).toBe(true);
        expect(move.length).toBe(2);
        const [r, c] = move;
        expect(r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE).toBe(true);
        expect(board[r][c]).toBeNull();

        const moveValidation = placeStoneLogic(r, c, board, 'white');
        expect(moveValidation.moveMade).toBe(true);
        expect(moveValidation.error).toBeUndefined();
    });

    test('AI passes if no valid moves are available (full board)', () => {
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                board[r][c] = 'black'; // Fill board
            }
        }
        const move = aiMakeRandomMove(board, 'white');
        expect(move).toBeNull(); // AI should pass
    });

    test('AI picks the only available valid move', () => {
        // Fill all but (0,0)
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (r !== 0 || c !== 0) {
                    board[r][c] = 'black';
                }
            }
        }
        // Ensure (0,0) is a valid move (not suicide)
        // If board is black, white playing at (0,0) is fine unless (0,1) and (1,0) are also black.
        // The default setup for this test makes (0,0) valid.
        const move = aiMakeRandomMove(board, 'white');
        expect(move).not.toBeNull();
        if (move) { // type guard
            expect(move).toEqual([0,0]);
        }
    });

    test('AI avoids simple suicide moves if other valid moves exist', () => {
        // AI is 'white'. Spot (0,0) is empty but suicidal.
        // (0,1) = B, (1,0) = B
        // (1,1) = null (a valid alternative move)
        board[0][1] = 'black';
        board[1][0] = 'black';
        board[1][1] = null; // This is a valid non-suicidal move

        // Verify (0,0) is indeed suicidal for white
        const suicidalMoveCheck = placeStoneLogic(0, 0, board, 'white');
        expect(suicidalMoveCheck.moveMade).toBe(false);
        expect(suicidalMoveCheck.error).toContain('self-capture');

        const move = aiMakeRandomMove(board, 'white');
        expect(move).not.toBeNull();
        expect(move).not.toEqual([0,0]); // Should not pick the suicidal spot

        // Refined check: Ensure AI picks one of the known valid alternatives
        // In this setup, (1,1) and its liberties (1,2), (2,1) should be valid.
        // The AI could pick (1,1), (1,2), or (2,1) if they are empty and valid.
        // The previous loop was too aggressive in filling.

        // Reset board for a clearer setup for this specific test part
        board = getInitialBoardState();
        board[0][1] = 'black'; // Suicidal spot (0,0) neighbor for White
        board[1][0] = 'black'; // Suicidal spot (0,0) neighbor for White
        // (0,0) is the suicidal spot.
        // (1,1) is a valid alternative.
        // (1,2) is another valid alternative.
        // (2,1) is another valid alternative.
        board[1][1] = null;
        board[1][2] = null;
        board[2][1] = null;

        // Fill all *other* spots to force AI's choice among (0,0), (1,1), (1,2), (2,1)
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (board[r][c] === null &&          // If empty
                    (r !== 0 || c !== 0) &&        // and not (0,0) - suicidal
                    (r !== 1 || c !== 1) &&        // and not (1,1) - valid alt 1
                    (r !== 1 || c !== 2) &&        // and not (1,2) - valid alt 2
                    (r !== 2 || c !== 1)           // and not (2,1) - valid alt 3
                ) {
                    board[r][c] = 'black'; // Occupy other spots
                }
            }
        }

        const constrainedMove = aiMakeRandomMove(board, 'white');
        expect(constrainedMove).not.toBeNull();
        expect(constrainedMove).not.toEqual([0,0]); // Must not be the suicidal spot

        const validAlternatives = [[1,1], [1,2], [2,1]];
        expect(validAlternatives).toContainEqual(constrainedMove); // Must be one of the valid ones

        if (constrainedMove) {
            const actualMoveCheck = placeStoneLogic(constrainedMove[0], constrainedMove[1], board, 'white');
            expect(actualMoveCheck.moveMade).toBe(true);
        }
    });

    test('AI passes if only suicidal moves are available', () => {
        board = getInitialBoardState();
        const aiPlayer = 'white';
        const opponentPlayer = 'black';

        // Fill the entire board with opponentPlayer stones
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                board[r][c] = opponentPlayer;
            }
        }

        // Create a single empty spot at (0,0) for the AI (white) to play
        board[0][0] = null;

        // Ensure its direct neighbors are opponentPlayer, making it a suicide spot
        // (0,0)'s neighbors on a large board are (0,1) and (1,0)
        if (BOARD_SIZE > 1) { // These checks are for robustness, BOARD_SIZE is 19
            board[0][1] = opponentPlayer;
            board[1][0] = opponentPlayer;
        }
        // On a very small board (e.g. 1x1, though BOARD_SIZE=19), (0,0) might have fewer neighbors.
        // The setup ensures (0,0) is surrounded by opponent or edge.

        // Call placeStoneLogic to confirm it *should* be suicide
        const suicidalMoveCheck = placeStoneLogic(0, 0, board, aiPlayer);

        // Log for debugging - may not appear in all test runners
        // console.log(`DEBUG: suicidalMoveCheck for (0,0) by ${aiPlayer}: ${JSON.stringify(suicidalMoveCheck)}`);
        // console.log(`DEBUG: Board state for this check (first few rows):`);
        // for(let i=0; i<Math.min(3, BOARD_SIZE); i++) { console.log(JSON.stringify(board[i].slice(0,Math.min(3, BOARD_SIZE)))); }


        // This is the critical assertion. If placeStoneLogic is correct, this should pass.
        expect(suicidalMoveCheck.moveMade).toBe(false);
        // If the above passes, it means placeStoneLogic correctly identified suicide.

        // Now test aiMakeRandomMove
        // Given that (0,0) is the only empty spot and it's suicidal, AI should pass.
        if (!suicidalMoveCheck.moveMade) {
            const move = aiMakeRandomMove(board, aiPlayer);
            expect(move).toBeNull(); // AI should pass
        } else {
            // This else block means placeStoneLogic failed to identify suicide.
            // The test will fail at the assertion above, but this provides a fallback message.
            throw new Error(`placeStoneLogic failed to identify a clear suicide. MoveMade: ${suicidalMoveCheck.moveMade}, Error: ${suicidalMoveCheck.error}`);
        }
    });
});
