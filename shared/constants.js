const CONFIG = {
    MIN_USERNAME_LENGTH: 2,
    MAX_USERNAME_LENGTH: 23,
    PLAYER_SPEED: 1.2,
    PLAYER_MAX_SPEED: 10,
    PLAYER_GROUND_FRICTION: 0.2,
    MAP_SIZE: { width: 15000, height: 15000 },
    CLIENT_UPD_RATE: 10,
    SERVER_UPD_RATE: 10,
    THEME: {
        BG_DEFAULT: 'linear-gradient(#101329, #020204)',
        MAP_OUT: '#333',
        MAP_IN: '#181c29',
        PLAYER_FILL: '#5eb319',
        PLAYER_OUT: '#3a700f',
        ENEMY_FILL: '#b31919',
        ENEMY_OUT: '#700f0f'
    },
    FOOD_SPAWN_RATE: 250,
    MAX_FOOD: 14000,
    FOOD_SIZE: 5,
    FOOD_MULTIPLIER: 5,
    BORDER_SIZE: 50,
    BORDER_COLOR: 'rgba(255, 0, 0, .6)',
    PUSH_SPEED: 2.3,
    MIN_SPLIT_SIZE: 125,
    MAX_SIZE_SLOWING_THRESHOLD: 1200,
    MIN_SLOWING_THRESHOLD: 0.3,
    FOLLOW_EPSILON: 5,
    SPLIT_EJECTION_FORCE: 18,
    BORDERS_SIZE: 2200,
    BORDERS_COLOR: 'rgba(255, 90, 90, .3)',
    MAX_VIRUSES: 30,
    VIRUS_SPAWN_RATE: 1550,
    VIRUS_SIZE: 75,
    VIRUS_COLOR: '#ab8e38',
    VIRUS_OUTER_COLOR: '#403514',
    TIME_BEFORE_FUSION: 23000,
    FUSION_DISTANCE: 40,
    WALLS_COLOR: 'rgb(155, 155, 155)',
    WALLS_COUNT: 10,
    WALLS_WIDTH_RANGE: [50, 700],
    WALLS_HEIGHT_RANGE: [50, 700],
    INITIAL_PLAYER_SIZE: 75,
    MIN_SHARE_SIZE: 200,
    SHARE_AMOUNT: 50,
    SHARE_EJECTION_FORCE: 15,
    STATIC_EAT_COOLDOWN: 3000
};

if (typeof module != 'undefined')
    module.exports = { CONFIG };