let socket = io();

/*
Game concept:

You're player is able to cast "patterns" to damage other players.

These patterns first appear as a "placeholder" (semi-transparent color) on the map for X seconds.

Then it suddenly appears in neon-style colors for X seconds,
while the pattern exist and is active, it damage any player it touches.
*/

document.addEventListener('DOMContentLoaded', () => {
    initializeMenu();
    initializeGame();
});
