const canvas = document.getElementById('online-canvas');
// const background = document.getElementById('online-background');
const ctx = canvas.getContext('2d');
const debugDiv = document.getElementById('online-debug');
const leaderboard = document.getElementById('leaderboard');

let players = [];
let foods = {};
let walls = [];
let viruses = [];
let pIdx = 0;
let inGame = false;
let clock = Date.now();
let scale = 1;
let zoom = 1;
let interface = undefined;
let keys = {};
let mousePos = { x: 0, y: 0 };

const movementKeys = ['KeyW', 'KeyS', 'KeyA', 'KeyD'];

// UTILITY

const clamp = (value, min, max) => Math.max(min, Math.min(value, max));
const rand = (min, max) => Math.floor((Math.random() * max) + min);
const dist = (pA, pB) => Math.sqrt(Math.pow(pB.x - pA.x, 2) + Math.pow(pB.y - pA.y, 2));

function getPlayerIdx(socketID)
{
    for (let i = 0; i < players.length; i++) {
        if (players[i].getSocketID() == socketID)
            return i;
    }

    return -1;
}

// SOCKETS

socket.on('createPlayer', (serializedData) => {
    let newPlayer = new Player('', '', CONFIG);

    newPlayer.loadSerializedData(serializedData);
    players.push(newPlayer);

    if (newPlayer.getSocketID() == socket.id)
        inGame = true;
});

socket.on('serverFull', () => {
    document.getElementById('server-error').classList.add('show');
    document.getElementById('server-error').innerHTML = 'Server is full, please try again later.';
});

socket.on('deletePlayer', (socketID) => {
    if (socketID == socket.id) {
        backToLobby();
        return;
    }

    let idx = -1;

    for (let i = 0; i < players.length; i++) {
        if (players[i].getSocketID() == socketID) {
            idx = i;
            break;
        }
    }

    if (idx >= 0)
        players.splice(idx, 1);
});

function backToLobby()
{
    players = [];
    foods = {};
    walls = [];
    pIdx = 0;
    inGame = false;
    clock = Date.now();
    zoom = 1;
    document.body.style.backgroundImage = CONFIG.THEME.BG_DEFAULT;
    document.body.style.background = CONFIG.THEME.BG_DEFAULT;

    displayMenu();
}

function updatePlayerIndex()
{
    players.forEach((player, idx) => {
        if (player.getSocketID() == socket.id)
            pIdx = idx;
    });
}

socket.on('initPlayers', (serializedPlayers) => {
    serializedPlayers.forEach((serializedPlayerData) => {
        let newPlayer = new Player('', '', CONFIG);

        newPlayer.loadSerializedData(serializedPlayerData);

        if (newPlayer.getSocketID() == socket.id || getPlayerIdx(newPlayer.getSocketID()) != -1)
            return;

        players.push(newPlayer);
    });

    updatePlayerIndex();
    initInterface();
});

socket.on('updatePlayers', (serializedPlayers) => {
    serializedPlayers.forEach((serializedPlayerData) => {
        let socketID = JSON.parse(serializedPlayerData).socketID;
        let idx = getPlayerIdx(socketID);

        if (idx == -1)
            return;

        players[idx].loadSerializedData(serializedPlayerData);
    });
});

socket.on('updateWalls', (newWalls) => {
    walls = newWalls;
});

socket.on('deletePlayer', (socketID) => {
    let deleteIdx = -1;

    players.forEach((player, index) => {
        if (player.getSocketID() == socketID)
            deleteIdx = index;
    });

    if (deleteIdx == -1)
        return;

    players.splice(deleteIdx, 1);
    updatePlayerIndex();
});

socket.on('initFoods', (foodObjects) => {
    Object.values(foodObjects).forEach((foodObject) => {
        foodObject.color = `rgb(${rand(100, 255)}, ${rand(100, 255)}, ${rand(100, 255)})`;

        foods[foodObject.id] = foodObject;
    });
});

socket.on('addFood', (foodObject) => {
    foodObject.color = `rgb(${rand(100, 255)}, ${rand(100, 255)}, ${rand(100, 255)})`;

    foods[foodObject.id] = foodObject;
});

socket.on('initViruses', (virusesArray) => {
    viruses = virusesArray;
});

socket.on('addVirus', (virusObject) => {
    viruses.push(virusObject);
});

// EVENTS

window.addEventListener('resize', () => {
    resizeCanvas();
});

window.addEventListener('keydown', (event) => {
    if (event.repeat || !inGame)
        return;

    switch (event.code) {
        case 'KeyW':
            players[pIdx].direction.y--;
            break;
        case 'KeyS':
            players[pIdx].direction.y++;
            break;
        case 'KeyA':
            players[pIdx].direction.x--;
            break;
        case 'KeyD':
            players[pIdx].direction.x++;
            break;
    }

    keys[event.code] = true;

    if (movementKeys.includes(event.code))
        updatePlayerDirection(players[pIdx].direction);
});

// 1

window.addEventListener('keyup', (event) => {
    if (event.repeat || !inGame)
        return;

    switch (event.code) {
        case 'KeyW':
            players[pIdx].direction.y++;
            break;
        case 'KeyS':
            players[pIdx].direction.y--;
            break;
        case 'KeyA':
            players[pIdx].direction.x++;
            break;
        case 'KeyD':
            players[pIdx].direction.x--;
            break;
        case 'Space':
            socket.emit('playerSplit', socket.id, mousePos, {
                x: window.innerWidth / 2,
                y: window.innerHeight / 2
            });

            break;
        case 'KeyZ':
            socket.emit('playerShare', socket.id, mousePos, {
                x: window.innerWidth / 2,
                y: window.innerHeight / 2
            });

            break;
    }

    keys[event.code] = false;

    if (movementKeys.includes(event.code))
        updatePlayerDirection(players[pIdx].direction);
});

document.addEventListener('mousemove', (event) => {
    event = event || window.event;

    mousePos.x = event.pageX;
    mousePos.y = event.pageY;
});

// GAME

function resizeCanvas()
{
    canvas.width = window.innerWidth * scale;
    canvas.height = window.innerHeight * scale;
    ctx.translate(canvas.width / 2, canvas.height / 2);
}

function initializeGame()
{
    resizeCanvas();
}

function startGame()
{
    initializeMap();
}

function initializeMap()
{
    document.body.style.background = CONFIG.THEME.MAP_OUT;
    /* background.style.width = CONFIG.MAP_SIZE.width + 'px';
    background.style.height = CONFIG.MAP_SIZE.height + 'px';
    background.style.background = CONFIG.THEME.MAP_IN; */
}

function gameLoop()
{
    let delta = (Date.now() - clock) * 0.1;

    update(delta);
    draw();

    clock = Date.now();
}

function update(delta)
{
    sortPlayers();
    correctDirectionErrors();

    for (let i = 0; i < players.length; i++) {
        predictPlayerPosition(i, delta);
    }

    updateFoods();
    updateViruses();
    doPlayersSizeComparison();
    doWallsCollisionCheck();

    if (interface != undefined)
        interface.update();

    let sizeFactor = Math.min(0.65, Math.floor(players[pIdx].getTotalSize() / 10) * 0.005);

    scale = 1 + sizeFactor;
    zoom = 1 - sizeFactor;
}

function sortPlayers()
{
    players = players.sort((a, b) => b.getTotalSize() - a.getTotalSize());

    updatePlayerIndex();
}

function correctDirectionErrors()
{
    let direction = players[pIdx].direction;

    if (!keys['KeyD'] && direction.x == 1) {
        players[pIdx].direction.x = 0;
        updatePlayerDirection({ x: 0, y: direction.y });
        return;
    }

    if (!keys['KeyA'] && direction.x == -1) {
        players[pIdx].direction.x = 0;
        updatePlayerDirection({ x: 0, y: direction.y });
        return;
    }

    if (!keys['KeyW'] && direction.y == -1) {
        players[pIdx].direction.y = 0;
        updatePlayerDirection({ x: direction.x, y: 0 });
        return;
    }

    if (!keys['KeyS'] && direction.y == 1) {
        players[pIdx].direction.y = 0;
        updatePlayerDirection({ x: direction.x, y: 0 });
        return;
    }
}

function updateBackground()
{
    let player_pos = players[pIdx].getPosition();
    let background_x = -(CONFIG.MAP_SIZE.width / 2) - player_pos.x;
    let background_y = -(CONFIG.MAP_SIZE.height / 2) - player_pos.y;

    background.style.transform = `translate(${background_x}px, ${background_y}px)`;
}

function draw()
{
    resetCanvas();

    ctx.save();
    ctx.scale(zoom, zoom);
    drawFoods();
    drawViruses();
    drawAllPlayers();
    drawWalls();
    ctx.restore();
}

function resetCanvas()
{
    /* ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore(); */

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = CONFIG.THEME.MAP_IN;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
}

function inRange(value, min, max)
{
    return (value >= min) && (value <= max);
}

function rectsOverlaps(rect1, rect2)
{
    let xOverlap = inRange(rect1.x, rect2.x, rect2.x + rect2.width) ||
                   inRange(rect2.x, rect1.x, rect1.x + rect1.width);

    let yOverlap = inRange(rect1.y, rect2.y, rect2.y + rect2.height) ||
                   inRange(rect2.y, rect1.y, rect1.y + rect1.height);

    return xOverlap && yOverlap;
}

function rectInScreen(rect)
{
    let scW = canvas.width * scale * 2.25;
    let scH = canvas.height * scale * 2.25;

    let screen = {
        x: -(scW / 2),
        y: -(scH / 2),
        width: scW,
        height: scH
    };

    return rectsOverlaps(screen, rect);
}

function drawWalls()
{
    walls.forEach((wall) => {
        let position = getRelativePosition(wall.x, wall.y);

        if (!rectInScreen({
            x: position.x,
            y: position.y,
            width: wall.width,
            height: wall.height
        }))
            return;

        ctx.fillStyle = wall.color;

        ctx.fillRect(position.x, position.y, wall.width, wall.height);
    });
}

function drawPlayer()
{
    ctx.fillStyle = CONFIG.THEME.PLAYER_FILL;
    ctx.strokeStyle = CONFIG.THEME.PLAYER_OUT;
    ctx.lineWidth = 3;

    let leader = players[pIdx].masses.filter(e => e.leader)[0] ?? null;

    if (leader == null)
        return;

    players[pIdx].masses.forEach((mass) => {
        let relativePosition = {
            x: mass.position.x - leader.position.x,
            y: mass.position.y - leader.position.y
        };

        ctx.beginPath();
        ctx.arc(relativePosition.x, relativePosition.y, mass.size / 2, 0, 2 * Math.PI);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    });
}

function getRelativePosition(ox, oy, massIdx = -1)
{
    let leader = players[pIdx].masses.filter(e => e.leader)[0] ?? null;

    if (massIdx != -1)
        leader = players[pIdx].masses[massIdx] ?? null;

    return {
        x: leader == null ? 0 : ox - leader.position.x,
        y: leader == null ? 0 : oy - leader.position.y
    };
}

function isOnScreen(x, y, size)
{
    let wWidth = canvas.width;
    let wHeight = canvas.height;

    x *= zoom;
    y *= zoom;

    let onScreen = x + (size / 2) > -(wWidth / 2)
                && x - (size / 2) < wWidth / 2
                && y + (size / 2) > -(wHeight / 2)
                && y - (size / 2) < wHeight / 2;

    return onScreen;
}

function drawPlayerTag(position, username)
{
    let textHeight = 15;

    ctx.fillStyle = 'rgba(0, 0, 0, .7)';
    ctx.font = `${textHeight}px sans-serif`;

    let textWidth = ctx.measureText(username).width;

    ctx.fillRect(
        position.x - (textWidth / 2) - 10,
        position.y - 17 - textHeight,
        textWidth + 20,
        textHeight + 10
    );

    ctx.fillStyle = '#fff';

    ctx.fillText(
        username,
        position.x - (textWidth / 2),
        position.y - 15
    );
}

function drawAllPlayers()
{
    let count = players.length;

    for (let i = count - 1; i >= 0; i--) {
        let player = players[i];

        if (player.getSocketID() == socket.id) {
            drawPlayer();
            continue;
        }

        player.masses.forEach((mass) => {
            let position = getRelativePosition(mass.position.x, mass.position.y);

            if (!isOnScreen(position.x, position.y, mass.size))
                return;

            ctx.fillStyle = CONFIG.THEME.ENEMY_FILL;
            ctx.strokeStyle = CONFIG.THEME.ENEMY_OUT;
            ctx.lineWidth = 3;

            ctx.beginPath();
            ctx.arc(position.x, position.y, mass.size / 2, 0, 2 * Math.PI);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            if (!mass.static)
                drawPlayerTag(position, player.username);
        });
    }
}

function drawFoods()
{
    Object.values(foods).forEach((food) => {
        let position = getRelativePosition(food.x, food.y);

        if (!isOnScreen(position.x, position.y, CONFIG.FOOD_SIZE))
            return;

        ctx.fillStyle = food.color;

        ctx.beginPath();
        ctx.arc(position.x, position.y, CONFIG.FOOD_SIZE, 0, 2 * Math.PI);
        ctx.closePath();
        ctx.fill();
    });
}

function drawViruses()
{
    viruses.forEach((virus) => {
        let position = getRelativePosition(virus.x, virus.y);

        if (!isOnScreen(position.x, position.y, CONFIG.VIRUS_SIZE))
            return;

        ctx.fillStyle = CONFIG.VIRUS_COLOR;
        ctx.strokeStyle = CONFIG.VIRUS_OUTER_COLOR;
        ctx.lineWidth = 5;

        ctx.beginPath();
        ctx.arc(position.x, position.y, CONFIG.VIRUS_SIZE, 0, 2 * Math.PI);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    });
}

function updateFoods()
{
    let toDelete = [];
    let validFoodObjects = [];

    Object.values(foods).forEach((food) => {
        let position = getRelativePosition(food.x, food.y);

        if (!isOnScreen(position.x, position.y, CONFIG.FOOD_SIZE))
            return;

        validFoodObjects.push(food);
    });

    players[pIdx].masses.forEach((pMass, pMassIdx) => {
        validFoodObjects.forEach((food) => {
            let foodPosition = { x: food.x, y: food.y };

            if (dist(pMass.position, foodPosition) > pMass.size / 2)
                return;

            toDelete.push(food.id);
            socket.emit('playerAteFood', socket.id, food.id, pMassIdx);
        });
    });

    toDelete.forEach((deleteIdx) => {
        delete foods[deleteIdx];
    });
}

function updateViruses()
{
    let validVirusObjects = [];

    viruses.forEach((virus, idx) => {
        let position = getRelativePosition(virus.x, virus.y);

        if (!isOnScreen(position.x, position.y, CONFIG.VIRUS_SIZE))
            return;

        virus.index = idx;
        validVirusObjects.push(virus);
    });

    let deleteIdx = -1;

    players[pIdx].masses.forEach((pMass) => {
        validVirusObjects.forEach((virus) => {
            let virusMassObject = {
                position: {
                    x: virus.x,
                    y: virus.y
                },
                size: CONFIG.VIRUS_SIZE * 2
            };

            if (!players[pIdx].canEat(pMass, virusMassObject))
                return;

            socket.emit('playerAteVirus', socket.id, virus);
            deleteIdx = virus.index;
        });
    });

    if (deleteIdx == -1)
        return;

    viruses.splice(deleteIdx, 1);
}

function doPlayersSizeComparison()
{
    players[pIdx].masses.forEach((pMass, pMassIdx) => {
        players.forEach((cPlayer) => {
            if (cPlayer.getSocketID() == socket.id)
                return;

            cPlayer.masses.forEach((cMass, cMassIdx) => {
                let absolutePosition = cMass.position;
                let position = getRelativePosition(absolutePosition.x, absolutePosition.y, pMassIdx);

                if (!isOnScreen(position.x, position.y, cMass.size))
                    return;

                if (!players[pIdx].canEat(pMass, cMass))
                    return;

                socket.emit('playerAtePlayer', socket.id, cPlayer.getSocketID(), pMassIdx, cMassIdx);
            });
        });
    });
}

function updatePlayerDirection(newDir)
{
    players[pIdx].direction.x = clamp(newDir.x, -1, 1);
    players[pIdx].direction.y = clamp(newDir.y, -1, 1);

    socket.emit('updatePlayerDirection', socket.id, players[pIdx].direction);
}

function predictPlayerPosition(idx, delta)
{
    players[idx].updatePosition(delta);
}

class GameInterface {
    constructor()
    {
        // ...
    }

    init()
    {
        // ...
    }

    update()
    {
        let playerPosition = players[pIdx].getPosition();

        debugDiv.innerHTML = `X: <span style='color: #6fc7ed'>${Math.floor(playerPosition.x)}</span>, Y: <span style='color: #6fc7ed'>${Math.floor(playerPosition.y)}</span><br />Mass: <span style='color: yellow'>${players[pIdx].getTotalSize()}</span>`;

        this.#updateLeaderboard();
    }

    #updateLeaderboard()
    {
        let topPlayers = players.slice(0, 10);
        let lastPlayers = leaderboard.querySelectorAll('li:not(:first-of-type)');

        lastPlayers.forEach((cPlayer) => {
            cPlayer.remove();
        });

        topPlayers.forEach((cPlayer) => {
            let newPlayer = document.createElement('li');

            newPlayer.innerHTML = `<label>${cPlayer.username}</label><span>${cPlayer.getTotalSize()}</span>`;

            leaderboard.appendChild(newPlayer);
        });
    }
};

function initInterface()
{
    interface = new GameInterface();

    interface.init();
}

function doWallsCollisionCheck()
{
    players.forEach((player) => {
        walls.forEach((wall) => {
            player.checkWallCollision(wall);
        });
    });
}
