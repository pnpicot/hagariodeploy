const { Player } = require('../shared/player');

let players = [];
let clock = Date.now();
let foodSpawnClock = 0;
let virusSpawnClock = 0;
let foodCount = 0;
let virusCount = 0;
let foods = {};
let walls = [];
let viruses = [];

module.exports = (CONFIG, io) => {
    let module = {};

    const rand = (min, max) => Math.floor((Math.random() * max) + min);

    module.createPlayer = (socketID, username) => {
        if (players.length >= 60)
            return false;

        let newPlayer = new Player(username, socketID, CONFIG);

        players.push(newPlayer);
        io.emit('createPlayer', newPlayer.serialize());
        io.to(socketID).emit('initPlayers', serializeAllPlayers());
        io.to(socketID).emit('initFoods', foods);
        io.to(socketID).emit('initViruses', viruses);
        io.to(socketID).emit('updateWalls', walls);

        return true;
    };

    module.deletePlayer = (socketID) => {
        let idx = -1;

        for (let i = 0; i < players.length; i++) {
            if (players[i].getSocketID() == socketID) {
                idx = i;
                break;
            }
        }

        if (idx >= 0) {
            players.splice(idx, 1);
            io.emit('deletePlayer', socketID);
        }
    };

    function serializeAllPlayers()
    {
        let data = [];

        players.forEach((player) => {
            data.push(player.serialize());
        });

        return data;
    }

    function getPlayerIdx(socketID)
    {
        for (let i = 0; i < players.length; i++) {
            if (players[i] == undefined)
                continue;

            if (players[i].getSocketID() == socketID)
                return i;
        }

        return -1;
    }

    function getGrowth(massSize, size)
    {
        let reduce = Math.max(0.1, 1 - ((massSize / 600) * 1));

        return Math.max(1, Math.floor(size * reduce));
    }

    module.updatePlayerDirection = (socketID, newDir) => {
        let pIdx = getPlayerIdx(socketID);

        if (pIdx == -1)
            return;

        players[pIdx].direction = newDir;
    }

    module.playerAteFood = (socketID, foodID, massIdx) => {
        let pIdx = getPlayerIdx(socketID);

        if (pIdx == -1)
            return;

        players[pIdx].masses[massIdx].size += getGrowth(players[pIdx].masses[massIdx].size, CONFIG.FOOD_SIZE);
        foodCount--;

        delete foods[foodID];
    };

    module.playerAteVirus = (socketID, virus) => {
        let pIdx = getPlayerIdx(socketID);

        if (pIdx == -1)
            return;

        forcePlayerSplit(pIdx);

        let deleteIdx = -1;

        viruses.forEach((pVirus, idx) => {
            if (pVirus.x != virus.x || pVirus.y != virus.y)
                return;

            deleteIdx = idx;
        });

        if (deleteIdx == -1)
            return;

        viruses.splice(deleteIdx, 1);
    };

    module.playerAtePlayer = (socketID, killedSocketID, eaterMassIdx, ateMassIdx) => {
        let pIdx = getPlayerIdx(socketID);
        let kpIdx = getPlayerIdx(killedSocketID);

        if (pIdx == -1 || kpIdx == -1 || players[pIdx].masses[eaterMassIdx] == undefined || players[kpIdx].masses[ateMassIdx] == undefined)
            return;

        if (!players[pIdx].canEat(players[pIdx].masses[eaterMassIdx], players[kpIdx].masses[ateMassIdx]))
            return;

        players[pIdx].masses[eaterMassIdx].size += getGrowth(players[pIdx].masses[eaterMassIdx].size, players[kpIdx].masses[ateMassIdx].size);
        players[kpIdx].masses.splice(ateMassIdx, 1);

        if (players[kpIdx].masses.length == 0) {
            players.splice(kpIdx, 1);
            io.emit('deletePlayer', killedSocketID);
        }
    };

    module.serverUpdate = () => {
        initWalls();
        initRandomWalls();

        const intervalID = setInterval(() => { update(); }, CONFIG.SERVER_UPD_RATE);
    };

    function initWalls()
    {
        walls.push({
            x: -(CONFIG.MAP_SIZE.width / 2) - CONFIG.BORDERS_SIZE,
            y: -(CONFIG.MAP_SIZE.height / 2) - CONFIG.BORDERS_SIZE,
            width: CONFIG.MAP_SIZE.width + (CONFIG.BORDERS_SIZE * 2),
            height: CONFIG.BORDERS_SIZE,
            color: CONFIG.BORDERS_COLOR
        });

        walls.push({
            x: CONFIG.MAP_SIZE.width / 2,
            y: -(CONFIG.MAP_SIZE.height / 2),
            width: CONFIG.BORDERS_SIZE,
            height: CONFIG.MAP_SIZE.height + CONFIG.BORDERS_SIZE,
            color: CONFIG.BORDERS_COLOR
        });

        walls.push({
            x: -(CONFIG.MAP_SIZE.width / 2) - CONFIG.BORDERS_SIZE,
            y: CONFIG.MAP_SIZE.height / 2,
            width: CONFIG.MAP_SIZE.width + CONFIG.BORDERS_SIZE,
            height: CONFIG.BORDERS_SIZE,
            color: CONFIG.BORDERS_COLOR
        });

        walls.push({
            x: -(CONFIG.MAP_SIZE.width / 2) - CONFIG.BORDERS_SIZE,
            y: -(CONFIG.MAP_SIZE.height / 2),
            width: CONFIG.BORDERS_SIZE,
            height: CONFIG.MAP_SIZE.height,
            color: CONFIG.BORDERS_COLOR
        });
    }

    function initRandomWalls()
    {
        let mapHalfWidth = Math.floor(CONFIG.MAP_SIZE.width / 2);
        let mapHalfHeight = Math.floor(CONFIG.MAP_SIZE.height / 2);

        for (let i = 0; i < CONFIG.WALLS_COUNT; i++) {
            let width = rand(CONFIG.WALLS_WIDTH_RANGE[0], CONFIG.WALLS_WIDTH_RANGE[1]);
            let height = rand(CONFIG.WALLS_HEIGHT_RANGE[0], CONFIG.WALLS_HEIGHT_RANGE[1]);
            let availableWidth = mapHalfWidth - width;
            let availableHeight = mapHalfHeight - height;

            walls.push({
                x: rand(0, availableWidth * 2) - availableWidth,
                y: rand(0, availableHeight * 2) - availableHeight,
                width: width,
                height: height,
                color: CONFIG.WALLS_COLOR
            });
        }
    }

    function update()
    {
        let realDelta = Date.now() - clock;
        let delta = realDelta * 0.1;

        foodSpawnClock += realDelta;
        virusSpawnClock += realDelta;

        for (let i = 0; i < players.length; i++) {
            updatePlayerPosition(i, delta);
            updatePlayerCollisions(i);
        }

        if (foodSpawnClock >= CONFIG.FOOD_SPAWN_RATE && foodCount < CONFIG.MAX_FOOD) {
            spawnRandomFood();

            foodSpawnClock = 0;
        }

        if (virusSpawnClock >= CONFIG.VIRUS_SPAWN_RATE && virusCount < CONFIG.MAX_VIRUSES) {
            spawnRandomVirus();

            virusSpawnClock = 0;
        }

        io.emit('updatePlayers', serializeAllPlayers());

        clock = Date.now();
    }

    function updatePlayerCollisions(idx)
    {
        walls.forEach((wall) => {
            players[idx].checkWallCollision(wall);
        });
    }

    function randomToken(size)
    {
        let token = '#';
        let chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

        for (let i = 0; i < size; i++) {
            token += chars[rand(0, chars.length - 1)];
        }

        return token;
    }

    function spawnRandomFood()
    {
        let mapHalfWidth = Math.floor(CONFIG.MAP_SIZE.width / 2);
        let mapHalfHeight = Math.floor(CONFIG.MAP_SIZE.height / 2);

        for (let i = 0; i < Math.min(CONFIG.MAX_FOOD - foodCount, CONFIG.FOOD_MULTIPLIER); i++) {
            let foodObject = {
                id: randomToken(7),
                x: rand(0, mapHalfWidth * 2) - mapHalfWidth,
                y: rand(0, mapHalfHeight * 2) - mapHalfHeight
            };

            foods[foodObject.id] = foodObject;
            io.emit('addFood', foodObject);

            foodCount++;
        }
    }

    function spawnRandomVirus()
    {
        let mapHalfWidth = Math.floor(CONFIG.MAP_SIZE.width / 2) - CONFIG.VIRUS_SIZE;
        let mapHalfHeight = Math.floor(CONFIG.MAP_SIZE.height / 2) - CONFIG.VIRUS_SIZE;

        let virusObject = {
            x: rand(0, mapHalfWidth * 2) - mapHalfWidth,
            y: rand(0, mapHalfHeight * 2) - mapHalfHeight
        };

        viruses.push(virusObject);

        io.emit('addVirus', virusObject);

        virusCount++;
    }

    function updatePlayerPosition(idx, delta)
    {
        if (players[idx] == undefined)
            return;

        players[idx].updatePosition(delta);
    }

    function forcePlayerSplit(pIdx)
    {
        players[pIdx].masses.forEach((pMass, pMassIdx) => {
            if (pMass.size < CONFIG.MIN_SPLIT_SIZE)
                return;

            players[pIdx].createMassNoEject(pMass.position, pMass.size / 2);
            players[pIdx].masses[pMassIdx].size /= 2;
        });
    }

    module.playerSplit = (socketID, mousePos, centerPos) => {
        let pIdx = getPlayerIdx(socketID);

        if (pIdx == -1)
            return;

        players[pIdx].masses.forEach((pMass, pMassIdx) => {
            if (pMass.size < CONFIG.MIN_SPLIT_SIZE)
                return;

            players[pIdx].createMass(pMass.position, pMass.size / 2, mousePos, centerPos);
            players[pIdx].masses[pMassIdx].size /= 2;
        });
    };

    module.playerShare = (socketID, mousePos, centerPos) => {
        let pIdx = getPlayerIdx(socketID);

        if (pIdx == -1)
            return;

        players[pIdx].masses.forEach((pMass, pMassIdx) => {
            if (pMass.size < CONFIG.MIN_SHARE_SIZE)
                return;

            players[pIdx].masses[pMassIdx].size -= CONFIG.SHARE_AMOUNT;
            players[pIdx].createStaticMass(pMass.position, CONFIG.SHARE_AMOUNT, mousePos, centerPos);
        });
    };

    return module;
}