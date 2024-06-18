class Player {
    #pushSpeed = 0;
    #lastMousePosition = { x: 0, y: 0 };
    #lastCenterPosition = { x: 0, y : 0 };
    lastSplitTime = 0;

    constructor(username, socketID, CONFIG)
    {
        let availableWidth = Math.floor(CONFIG.MAP_SIZE.width / 2) - CONFIG.INITIAL_PLAYER_SIZE;
        let availableHeight = Math.floor(CONFIG.MAP_SIZE.height / 2) - CONFIG.INITIAL_PLAYER_SIZE;

        this.username = username;
        this.socketID = socketID;
        this.position = { x: this.#randInt(0, availableWidth * 2) - availableWidth, y: this.#randInt(0, availableHeight * 2) - availableHeight };
        this.velocity = { x: 0, y: 0 };
        this.speed = CONFIG.PLAYER_SPEED;
        this.maxSpeed = CONFIG.PLAYER_MAX_SPEED;
        this.maxSizeSlowingThreshold = CONFIG.MAX_SIZE_SLOWING_THRESHOLD;
        this.minSlowingThreshold = CONFIG.MIN_SLOWING_THRESHOLD;
        this.followEpsilon = CONFIG.FOLLOW_EPSILON;
        this.splitEjectionForce = CONFIG.SPLIT_EJECTION_FORCE;
        this.timeBeforeFusion = CONFIG.TIME_BEFORE_FUSION;
        this.fusionDistance = CONFIG.FUSION_DISTANCE;
        this.size = CONFIG.INITIAL_PLAYER_SIZE;
        this.shareEjectionForce = CONFIG.SHARE_EJECTION_FORCE;
        this.staticEatCooldown = CONFIG.STATIC_EAT_COOLDOWN;

        this.masses = [{
            size: CONFIG.INITIAL_PLAYER_SIZE,
            position: {
                x: this.#randInt(0, availableWidth * 2) - availableWidth, y: this.#randInt(0, availableHeight * 2) - availableHeight
            },
            velocity: { x: 0, y: 0 },
            force: { x: 0, y: 0 },
            leader: true,
            static: false
        }];

        this.color = '#333';
        this.direction = { x: 0, y: 0 };
        this.friction = CONFIG.PLAYER_GROUND_FRICTION;
        this.#pushSpeed = CONFIG.PUSH_SPEED;
    }

    createMass(from, size, mousePos, centerPos)
    {
        let offset = {
            x: this.#randInt(-2, 2),
            y: this.#randInt(-2, 2)
        };

        this.masses.push({
            size: size,
            position: { x: from.x + offset.x, y: from.y + offset.y },
            velocity: { x: 0, y: 0 },
            force: { x: 0, y: 0 },
            leader: false,
            static: false
        });

        this.#lastMousePosition = mousePos;
        this.#lastCenterPosition = centerPos;

        this.redefineLeader();
        this.#ejectMass(this.getLeaderIdx(), this.splitEjectionForce, this.#getCursorAngle());

        this.lastSplitTime = Date.now();
    }

    createStaticMass(from, size, mousePos, centerPos)
    {
        let offset = {
            x: this.#randInt(-2, 2),
            y: this.#randInt(-2, 2)
        };

        this.masses.push({
            size: size,
            position: { x: from.x + offset.x, y: from.y + offset.y },
            velocity: { x: 0, y: 0 },
            force: { x: 0, y: 0 },
            leader: false,
            static: true,
            staticDate: Date.now()
        });

        this.#lastMousePosition = mousePos;
        this.#lastCenterPosition = centerPos;

        this.#ejectMass(this.masses.length - 1, this.shareEjectionForce, this.#getCursorAngle());
    }

    createMassNoEject(from, size)
    {
        let offset = {
            x: this.#randInt(-2, 2),
            y: this.#randInt(-2, 2)
        };

        this.masses.push({
            size: size,
            position: { x: from.x + offset.x, y: from.y + offset.y },
            velocity: { x: 0, y: 0 },
            force: { x: 0, y: 0 },
            leader: false,
            static: false
        });

        this.redefineLeader();

        this.lastSplitTime = Date.now();
    }

    #getCursorAngle()
    {
        let position = this.#lastMousePosition;
        let center = this.#lastCenterPosition;

        return Math.atan2(position.y - center.y, position.x - center.x);
    }

    #sizeToSpeed(size)
    {
        let factor = Math.max(1 - (size / this.maxSizeSlowingThreshold), this.minSlowingThreshold);

        return {
            speed: this.speed * factor,
            maxSpeed: this.maxSpeed * factor
        };
    }

    getBiggestMassIdx(includeStatic = false)
    {
        let idx = 0;
        let biggestMass = this.masses[0]?.size ?? 0;
        let firstStatic = this.masses[0]?.static;

        this.masses.forEach((mass, index) => {
            if (!includeStatic && mass.static)
                return;

            if (mass.size > biggestMass || firstStatic) {
                biggestMass = mass.size;
                idx = index;
            }
        });

        return idx;
    }

    getLeaderIdx()
    {
        let idx = -1;

        this.masses.forEach((mass, index) => {
            if (mass.leader) {
                idx = index;
                return;
            }
        });

        return idx;
    }

    redefineLeader()
    {
        let leaderIdx = this.getLeaderIdx();
        let biggestIdx = this.getBiggestMassIdx(false);

        if (leaderIdx == -1 || biggestIdx == -1)
            return;

        this.masses[leaderIdx].leader = false;
        this.masses[biggestIdx].leader = true;
    }

    getSocketID()
    {
        return this.socketID;
    }

    getPosition()
    {
        let leader = this.masses.filter(e => e.leader)[0] ?? null;

        if (leader == null)
            return { x: 0, y: 0 };

        return leader.position;
    }

    getTotalSize()
    {
        let total = 0;

        this.masses.forEach((mass) => {
            if (mass.static)
                return;

            total += mass.size;
        });

        return total;
    }

    serialize()
    {
        return JSON.stringify(this);
    }

    #randInt(min, max)
    {
        return Math.round((Math.random() * max) + min);
    }

    loadSerializedData(data)
    {
        let unserialized = JSON.parse(data);

        Object.keys(unserialized).forEach((key) => {
            this[key] = unserialized[key];
        });
    }

    #clamp(value, min, max)
    {
        return Math.max(min, Math.min(value, max));
    }

    #dist(pA, pB)
    {
        return Math.sqrt(Math.pow(pB.x - pA.x, 2) + Math.pow(pB.y - pA.y, 2));
    }

    updatePosition(delta)
    {
        this.#updateLeaderPosition(delta);
        this.#followLeader(delta);
        this.#applyForceVelocity(delta);
        this.#rearrangeMasses(delta);
        this.#attemptStaticEat();
    }

    #followLeader(delta)
    {
        let leaderIdx = this.getLeaderIdx();

        if (leaderIdx == -1)
            return;

        let leaderPosition = this.masses[leaderIdx].position;
        let lastSplitDuration = Date.now() - this.lastSplitTime;
        let followEpsilonOffset = Math.min(lastSplitDuration, this.timeBeforeFusion) / this.timeBeforeFusion;

        this.masses.forEach((mass, idx) => {
            if (idx == leaderIdx || mass.static)
                return;

            let position = mass.position;
            let params = this.#sizeToSpeed(mass.size);

            let offset = {
                x: leaderPosition.x - position.x,
                y: leaderPosition.y - position.y
            };

            let offsetLength = Math.sqrt(Math.pow(offset.x, 2) + Math.pow(offset.y, 2));
            let outerDistance = Math.abs(offsetLength) - (this.masses[leaderIdx].size / 2) - (mass.size / 2);
            let epsilon = this.followEpsilon - (followEpsilonOffset * mass.size * 0.9);

            if (outerDistance <= epsilon)
                return;

            this.masses[idx].position.x += Math.min(outerDistance - epsilon, ((params.maxSpeed * delta) / offsetLength) * offset.x);
            this.masses[idx].position.y += Math.min(outerDistance - epsilon, ((params.maxSpeed * delta) / offsetLength) * offset.y);
        });

        if (this.masses.length > 1 && lastSplitDuration >= this.timeBeforeFusion)
            this.#attemptFusion();
    }

    #attemptFusion()
    {
        let stop = false;
        let fusionA = -1;
        let fusionB = -1;

        this.masses.forEach((pMass, pMassIdx) => {
            if (stop || pMass.static)
                return;

            this.masses.forEach((cMass, cMassIdx) => {
                if (pMassIdx == cMassIdx || stop || cMass.static)
                    return;

                if (this.#dist(pMass.position, cMass.position) > this.fusionDistance)
                    return;

                fusionA = pMassIdx;
                fusionB = cMassIdx;
                stop = true;
            });
        });

        if (fusionA == -1 || fusionB == -1)
            return;

        this.masses[fusionA].size += this.masses[fusionB].size;
        this.masses.splice(fusionB, 1);
        this.redefineLeader();
    }

    #attemptStaticEat()
    {
        let stop = false;
        let eater = -1;
        let eaten = -1;

        this.masses.forEach((pMass, pMassIdx) => {
            if (stop || pMass.static)
                return;

            this.masses.forEach((cMass, cMassIdx) => {
                if (stop || !cMass.static)
                    return;

                if (!this.canEat(pMass, cMass) || Date.now() - cMass.staticDate < this.staticEatCooldown)
                    return;

                eater = pMassIdx;
                eaten = cMassIdx;
                stop = true;
            });
        });

        if (eater == -1 || eaten == -1)
            return;

        this.masses[eater].size += this.masses[eaten].size;
        this.masses.splice(eaten, 1);
    }

    #updateLeaderPosition(delta)
    {
        let idx = this.getLeaderIdx();

        if (idx == -1)
            return;

        let params = this.#sizeToSpeed(this.masses[idx].size);

        this.masses[idx].velocity.x += this.direction.x ? this.direction.x * params.speed : 0;
        this.masses[idx].velocity.y += this.direction.y ? this.direction.y * params.speed : 0;
        this.masses[idx].velocity.x = this.#clamp(this.masses[idx].velocity.x, -params.maxSpeed, params.maxSpeed);
        this.masses[idx].velocity.y = this.#clamp(this.masses[idx].velocity.y, -params.maxSpeed, params.maxSpeed);

        this.masses[idx].position.x += delta * this.masses[idx].velocity.x;
        this.masses[idx].position.y += delta * this.masses[idx].velocity.y;

        if (this.masses[idx].velocity.x < 0) {
            this.masses[idx].velocity.x += this.friction;
            this.masses[idx].velocity.x = Math.min(0, this.masses[idx].velocity.x);
        } else if (this.masses[idx].velocity.x > 0) {
            this.masses[idx].velocity.x -= this.friction;
            this.masses[idx].velocity.x = Math.max(0, this.masses[idx].velocity.x);
        }

        if (this.masses[idx].velocity.y < 0) {
            this.masses[idx].velocity.y += this.friction;
            this.masses[idx].velocity.y = Math.min(0, this.masses[idx].velocity.y);
        } else if (this.masses[idx].velocity.y > 0) {
            this.masses[idx].velocity.y -= this.friction;
            this.masses[idx].velocity.y = Math.max(0, this.masses[idx].velocity.y);
        }
    }

    #applyForceVelocity(delta)
    {
        this.masses.forEach((mass, idx) => {
            this.masses[idx].position.x += delta * mass.force.x;
            this.masses[idx].position.y += delta * mass.force.y;

            if (mass.force.x < 0) {
                this.masses[idx].force.x += this.friction;
                this.masses[idx].force.x = Math.min(0, mass.force.x);
            } else if (this.masses[idx].force.x > 0) {
                this.masses[idx].force.x -= this.friction;
                this.masses[idx].force.x = Math.max(0, mass.force.x);
            }

            if (mass.force.y < 0) {
                this.masses[idx].force.y += this.friction;
                this.masses[idx].force.y = Math.min(0, mass.force.y);
            } else if (mass.force.y > 0) {
                this.masses[idx].force.y -= this.friction;
                this.masses[idx].force.y = Math.max(0, mass.force.y);
            }
        });
    }

    #ejectMass(massIdx, force, angle)
    {
        if (this.masses[massIdx] == undefined)
            return;

        this.masses[massIdx].force.x += Math.cos(angle) * force;
        this.masses[massIdx].force.y += Math.sin(angle) * force;
    }

    #normalizeVector(vector)
    {
        let length = Math.sqrt(Math.pow(vector.x, 2) + Math.pow(vector.y, 2));

        if (length == 0)
            return { x: 0, y: 0 };

        return {
            x: vector.x / length,
            y: vector.y / length
        }
    }

    #rearrangeMasses(delta)
    {
        let leaderIdx = this.getLeaderIdx();

        this.masses.forEach((aMass, aMassIdx) => {
            if (aMass.static)
                return;

            this.masses.forEach((bMass, bMassIdx) => {
                if (bMassIdx == aMassIdx || aMassIdx == leaderIdx || bMass.static)
                    return;

                let distance = this.#dist(aMass.position, bMass.position);

                if (distance >= (aMass.size / 2) + (bMass.size / 2))
                    return;

                let pushDirection = this.#normalizeVector({
                    x: aMass.position.x - bMass.position.x,
                    y: aMass.position.y - bMass.position.y
                });

                this.masses[aMassIdx].position.x += pushDirection.x * delta * this.#pushSpeed;
                this.masses[aMassIdx].position.y += pushDirection.y * delta * this.#pushSpeed;
            });
        });
    }

    checkWallCollision(wall)
    {
        this.masses.forEach((mass, idx) => {
            let radius = mass.size / 2;
            let closestX = Math.max(wall.x, Math.min(mass.position.x, wall.x + wall.width));
            let closestY = Math.max(wall.y, Math.min(mass.position.y, wall.y + wall.height));

            if (this.#dist(mass.position, { x: closestX, y: closestY }) < radius)
                this.#resolveWallCollision(wall, idx, closestX, closestY);
        });
    }

    #resolveWallCollision(wall, massIdx, closestX, closestY)
    {
        let mass = this.masses[massIdx];
        let radius = mass.size / 2;
        let distanceX = mass.position.x - closestX;
        let distanceY = mass.position.y - closestY;
        let distance = Math.sqrt((distanceX * distanceX) + (distanceY * distanceY));

        if (distance === 0) {
            distanceX = radius;
            distanceY = 0;
            distance = radius;
        }

        let overlap = radius - distance;
        let normX = distanceX / distance;
        let normY = distanceY / distance;

        this.masses[massIdx].position.x += normX * overlap;
        this.masses[massIdx].position.y += normY * overlap;
    }

    canEat(massA, massB)
    {
        let radiusA = massA.size / 2;
        let radiusB = massB.size / 2;
        let areaA = Math.PI * radiusA * radiusA;
        let areaB = Math.PI * radiusB * radiusB;

        if (areaA < 1.1 * areaB)
            return false;

        let distanceX = massA.position.x - massB.position.x;
        let distanceY = massA.position.y - massB.position.y;
        let distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

        if (distance <= radiusA) {
            let overlapRadius = radiusA - distance;
            let overlapArea = Math.PI * overlapRadius * overlapRadius;
            let smallerArea = Math.PI * radiusB * radiusB;
            let overlapPercentage = overlapArea / smallerArea;

            return overlapPercentage >= 0.8;
        }

        return false;
    }
}

if (typeof module != 'undefined')
    module.exports = { Player };
