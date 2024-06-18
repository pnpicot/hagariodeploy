const usernameInput = document.getElementById('player-username');
const offlineUI = document.getElementById('offline-ui');
const onlineContent = document.getElementById('online-content');
let gameLoopInterval = undefined;

function displayMenu()
{
    offlineUI?.classList.remove('hidden');
    onlineContent?.classList.remove('show');
    window.clearInterval(gameLoopInterval);
}

function initializeMenu()
{
    let joinGameButton = document.getElementById('btn-join');

    joinGameButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();

        attemptJoinGame();
    });

    usernameInput.addEventListener('keyup', (event) => {
        if (event.code == 'Enter')
            joinGameButton.click();
    });

    usernameInput.setAttribute('minlength', CONFIG.MIN_USERNAME_LENGTH);
    usernameInput.setAttribute('maxlength', CONFIG.MAX_USERNAME_LENGTH);
    usernameInput.focus();
}

function attemptJoinGame()
{
    const username = usernameInput.value;

    if (username.length < CONFIG.MIN_USERNAME_LENGTH || username.length > CONFIG.MAX_USERNAME_LENGTH) {
        alert('Invalid username size');
        return;
    }

    socket.emit('createPlayer', socket.id, username);

    offlineUI?.classList.add('hidden');
    onlineContent?.classList.add('show');

    document.getElementById('st-username').innerHTML = username;

    startGame();

    gameLoopInterval = window.setInterval(() => { gameLoop(); }, CONFIG.CLIENT_UPD_RATE);
}