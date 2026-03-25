// 游戏常量配置
const CONFIG = {
    canvasWidth: 800,
    canvasHeight: 480,
    gravity: 0.8,
    friction: 0.8,
    jumpStrength: -15,
    moveSpeed: 5,
    tileWidth: 40,
    tileHeight: 40,
    spriteSize: 16, // 原版像素大小
    assets: {
        // 使用 CDN 加速资源，解决 raw.githubusercontent.com 加载慢的问题
        tiles: 'https://cdn.jsdelivr.net/gh/meth-meth-method/super-mario@master/public/img/tiles.png',
        sprites: 'https://cdn.jsdelivr.net/gh/meth-meth-method/super-mario@master/public/img/sprites.png'
    }
};

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const statusText = document.getElementById('status-text');
const overlay = document.getElementById('overlay');

canvas.width = CONFIG.canvasWidth;
canvas.height = CONFIG.canvasHeight;

// 禁用图像平滑以保持像素风
ctx.imageSmoothingEnabled = false;

let score = 0;
let gameOver = false;
let gameWon = false;
let cameraX = 0;

// 资源加载
const images = {};
let assetsLoaded = 0;
const totalAssets = 2;

function loadAssets(callback) {
    // 渲染简单的加载提示
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('正在加载像素资源...', canvas.width / 2, canvas.height / 2);

    const assetKeys = Object.keys(CONFIG.assets);
    assetKeys.forEach(key => {
        const img = new Image();
        img.src = CONFIG.assets[key];
        img.onload = () => {
            assetsLoaded++;
            if (assetsLoaded === totalAssets) {
                callback();
            }
        };
        img.onerror = () => {
            console.error(`资源加载失败: ${key}`);
            // 如果加载失败，尝试继续启动，以免页面完全卡住
            assetsLoaded++;
            if (assetsLoaded === totalAssets) callback();
        };
        images[key] = img;
    });
}

// 键盘控制
const keys = {
    right: false,
    left: false,
    up: false
};

window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = true;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = true;
    if (e.code === 'KeyW' || e.code === 'ArrowUp' || e.code === 'Space') keys.up = true;
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = false;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = false;
    if (e.code === 'KeyW' || e.code === 'ArrowUp' || e.code === 'Space') keys.up = false;
});

// 精灵坐标配置
const SPRITES = {
    player: {
        idle: [0, 48],   // NES 原版 Mario (红色) 的像素坐标
        run1: [16, 48],
        run2: [32, 48],
        run3: [48, 48],
        jump: [80, 48]
    },
    enemy: {
        walk1: [0, 4], // 板栗仔像素坐标
        walk2: [16, 4],
        flat: [32, 4]
    },
    tiles: {
        ground: [0, 0],
        brick: [1, 0],
        pipeTL: [0, 8], // 注意：原版配置中水管可能在这里
        pipeTR: [1, 8],
        pipeBL: [0, 9],
        pipeBR: [1, 9],
        coin: [15, 0]
    }
};

// 基础物理对象
class GameObject {
    constructor(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.vx = 0;
        this.vy = 0;
    }
}

// 玩家类
class Player extends GameObject {
    constructor() {
        super(100, 300, 32, 32);
        this.grounded = false;
        this.facing = 1; // 1: 右, -1: 左
        this.animFrame = 0;
        this.animTimer = 0;
        this.state = 'idle';
    }

    update() {
        if (keys.right) {
            this.vx += 1;
            this.facing = 1;
        } else if (keys.left) {
            this.vx -= 1;
            this.facing = -1;
        }

        this.vx *= CONFIG.friction;
        if (Math.abs(this.vx) < 0.1) this.vx = 0;
        this.vx = Math.max(-CONFIG.moveSpeed, Math.min(CONFIG.moveSpeed, this.vx));
        this.x += this.vx;

        if (keys.up && this.grounded) {
            this.vy = CONFIG.jumpStrength;
            this.grounded = false;
        }

        this.vy += CONFIG.gravity;
        this.y += this.vy;

        this.grounded = false;

        if (this.x < 0) {
            this.x = 0;
            this.vx = 0;
        }

        // 掉出屏幕游戏结束
        if (this.y > CONFIG.canvasHeight) {
            endGame('游戏结束');
        }

        // 动画状态切换
        if (!this.grounded) {
            this.state = 'jump';
        } else if (Math.abs(this.vx) > 0.5) {
            this.state = 'run';
            this.animTimer++;
            if (this.animTimer > 5) {
                this.animFrame = (this.animFrame + 1) % 3;
                this.animTimer = 0;
            }
        } else {
            this.state = 'idle';
            this.animFrame = 0;
        }
    }

    draw() {
        let coords;
        if (this.state === 'jump') {
            coords = SPRITES.player.jump;
        } else if (this.state === 'run') {
            const frames = [SPRITES.player.run1, SPRITES.player.run2, SPRITES.player.run3];
            coords = frames[this.animFrame];
        } else {
            coords = SPRITES.player.idle;
        }

        if (!images.sprites || !images.sprites.complete) {
            // 降级渲染：红色方块
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(this.x - cameraX, this.y, this.w, this.h);
            return;
        }

        ctx.save();
        if (this.facing === -1) {
            ctx.translate(this.x - cameraX + this.w, this.y);
            ctx.scale(-1, 1);
            ctx.drawImage(images.sprites, coords[0], coords[1], 16, 16, 0, 0, this.w, this.h);
        } else {
            ctx.drawImage(images.sprites, coords[0], coords[1], 16, 16, this.x - cameraX, this.y, this.w, this.h);
        }
        ctx.restore();
    }
}

// 敌人
class Enemy extends GameObject {
    constructor(x, y) {
        super(x, y, 32, 32);
        this.dir = -1;
        this.speed = 1.5;
        this.animFrame = 0;
        this.animTimer = 0;
    }

    update() {
        this.x += this.dir * this.speed;
        this.animTimer++;
        if (this.animTimer > 10) {
            this.animFrame = (this.animFrame + 1) % 2;
            this.animTimer = 0;
        }
        
        // 简单转向
        if (this.x < 0) this.dir = 1;
    }

    draw() {
        if (!images.sprites || !images.sprites.complete) {
            ctx.fillStyle = '#8b4513';
            ctx.fillRect(this.x - cameraX, this.y, this.w, this.h);
            return;
        }
        const coords = this.animFrame === 0 ? SPRITES.enemy.walk1 : SPRITES.enemy.walk2;
        ctx.drawImage(images.sprites, coords[0], coords[1], 16, 16, this.x - cameraX, this.y, this.w, this.h);
    }
}

// 瓦片/平台
class Tile extends GameObject {
    constructor(x, y, w, h, type) {
        super(x, y, w, h);
        this.type = type;
    }

    draw() {
        if (!images.tiles || !images.tiles.complete) {
            ctx.fillStyle = (this.type === 'ground') ? '#73c33d' : '#8b4513';
            ctx.fillRect(this.x - cameraX, this.y, this.w, this.h);
            return;
        }

        let coords = SPRITES.tiles[this.type] || SPRITES.tiles.ground;
        const gridX = 40;
        const gridY = 40;
        const cols = Math.ceil(this.w / gridX);
        const rows = Math.ceil(this.h / gridY);

        for (let i = 0; i < cols; i++) {
            for (let j = 0; j < rows; j++) {
                let currentCoords = [...coords];
                if (this.type === 'pipe') {
                    if (i === 0 && j === 0) currentCoords = SPRITES.tiles.pipeTL;
                    else if (i === 1 && j === 0) currentCoords = SPRITES.tiles.pipeTR;
                    else if (i === 0) currentCoords = SPRITES.tiles.pipeBL;
                    else currentCoords = SPRITES.tiles.pipeBR;
                }
                ctx.drawImage(images.tiles, currentCoords[0] * 16, currentCoords[1] * 16, 16, 16, 
                    this.x - cameraX + i * gridX, this.y + j * gridY, gridX, gridY);
            }
        }
    }
}

// 金币
class Coin extends GameObject {
    constructor(x, y) {
        super(x, y, 24, 24);
        this.collected = false;
    }

    draw() {
        if (this.collected) return;
        if (!images.tiles || !images.tiles.complete) {
            ctx.fillStyle = '#ffd700';
            ctx.beginPath();
            ctx.arc(this.x + this.w/2 - cameraX, this.y + this.h/2, this.w/2, 0, Math.PI * 2);
            ctx.fill();
            return;
        }
        const coords = SPRITES.tiles.coin;
        ctx.drawImage(images.tiles, coords[0] * 16, coords[1] * 16, 16, 16, this.x - cameraX, this.y, this.w, this.h);
    }
}

let player;
let platforms = [];
let coins = [];
let enemies = [];

function init() {
    score = 0;
    gameOver = false;
    gameWon = false;
    cameraX = 0;
    scoreEl.innerText = score;
    overlay.classList.add('hidden');

    player = new Player();
    
    platforms = [];
    // 增加地形深度，确保马里奥能落在地面上
    platforms.push(new Tile(0, 440, 1000, 40, 'ground'));
    platforms.push(new Tile(1100, 440, 1500, 40, 'ground'));
    
    // 砖块
    platforms.push(new Tile(200, 320, 120, 40, 'brick'));
    platforms.push(new Tile(400, 240, 120, 40, 'brick'));
    
    // 水管 (宽80, 高80)
    platforms.push(new Tile(600, 360, 80, 80, 'pipe'));
    platforms.push(new Tile(900, 360, 80, 80, 'pipe'));
    
    coins = [
        new Coin(250, 280),
        new Coin(450, 200),
        new Coin(630, 330),
        new Coin(1200, 400)
    ];
    
    enemies = [
        new Enemy(500, 408),
        new Enemy(1300, 408)
    ];

    requestAnimationFrame(gameLoop);
}

function gameLoop() {
    if (gameOver) return;

    // 清空画布
    ctx.fillStyle = '#5c94fc'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    player.update();
    
    if (player.x > CONFIG.canvasWidth / 2) {
        cameraX = player.x - CONFIG.canvasWidth / 2;
    }

    // 碰撞检测与绘制
    platforms.forEach(p => {
        const side = checkCollision(player, p);
        if (side === 'top') {
            player.vy = 0;
            player.grounded = true;
        } else if (side === 'bottom') {
            player.vy = 0;
        } else if (side === 'left' || side === 'right') {
            player.vx = 0;
        }
        p.draw();
    });

    enemies.forEach((e, idx) => {
        e.update();
        const side = checkCollision(player, e);
        if (side === 'top') {
            enemies.splice(idx, 1);
            player.vy = -10;
            score += 100;
            scoreEl.innerText = score;
        } else if (side) {
            endGame('游戏结束');
        }
        e.draw();
    });

    coins.forEach(c => {
        if (!c.collected && checkCollision(player, c)) {
            c.collected = true;
            score += 50;
            scoreEl.innerText = score;
        }
        c.draw();
    });

    player.draw();

    if (player.x > 2400) {
        endGame('通关大吉！', true);
    }

    requestAnimationFrame(gameLoop);
}

function checkCollision(obj1, obj2) {
    let dx = (obj1.x + obj1.w / 2) - (obj2.x + obj2.w / 2);
    let dy = (obj1.y + obj1.h / 2) - (obj2.y + obj2.h / 2);
    let combinedHalfWidths = (obj1.w / 2) + (obj2.w / 2);
    let combinedHalfHeights = (obj1.h / 2) + (obj2.h / 2);

    if (Math.abs(dx) < combinedHalfWidths && Math.abs(dy) < combinedHalfHeights) {
        let overlapX = combinedHalfWidths - Math.abs(dx);
        let overlapY = combinedHalfHeights - Math.abs(dy);

        if (overlapX >= overlapY) {
            if (dy > 0) {
                obj1.y += overlapY;
                return 'bottom';
            } else {
                obj1.y -= overlapY;
                return 'top';
            }
        } else {
            if (dx > 0) {
                obj1.x += overlapX;
                return 'left';
            } else {
                obj1.x -= overlapX;
                return 'right';
            }
        }
    }
    return null;
}

function endGame(text, win = false) {
    gameOver = true;
    statusText.innerText = text;
    statusText.style.color = win ? '#4ade80' : '#ef4444';
    overlay.classList.remove('hidden');
}

function resetGame() {
    init();
}

// 启动
loadAssets(() => {
    init();
});
