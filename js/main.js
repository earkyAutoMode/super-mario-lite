
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
    // 资源配置
    assets: {
        // 使用一个包含全资源的精灵图链接（常用的马里奥 1-1 资产图）
        sprites: 'https://raw.githubusercontent.com/yemreak/Super-Mario-Bros/master/img/sprites.png'
    }
};

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const statusText = document.getElementById('status-text');
const overlay = document.getElementById('overlay');

canvas.width = CONFIG.canvasWidth;
canvas.height = CONFIG.canvasHeight;

// 图像资源加载
const spriteSheet = new Image();
spriteSheet.src = 'https://raw.githubusercontent.com/meth-meth-method/super-mario/master/public/img/tiles.png';
const charSheet = new Image();
charSheet.src = 'https://raw.githubusercontent.com/meth-meth-method/super-mario/master/public/img/characters.png';

// 精灵图切片坐标映射 (基于常用的 NES 16x16 规格)
const SPRITE_MAP = {
    ground: { x: 0, y: 0, w: 16, h: 16 },
    brick: { x: 16, y: 0, w: 16, h: 16 },
    question: { x: 384, y: 0, w: 16, h: 16 },
    pipe_top_left: { x: 0, y: 128, w: 16, h: 16 },
    pipe_top_right: { x: 16, y: 128, w: 16, h: 16 },
    pipe_left: { x: 0, y: 144, w: 16, h: 16 },
    pipe_right: { x: 16, y: 144, w: 16, h: 16 },
    mario_idle: { x: 276, y: 44, w: 16, h: 16 },
    mario_run1: { x: 290, y: 44, w: 16, h: 16 },
    mario_run2: { x: 304, y: 44, w: 16, h: 16 },
    mario_jump: { x: 355, y: 44, w: 16, h: 16 },
    goomba1: { x: 0, y: 16, w: 16, h: 16 },
    goomba2: { x: 16, y: 16, w: 16, h: 16 },
    coin: { x: 384, y: 0, w: 16, h: 16 }
};

let score = 0;
let gameOver = false;
let gameWon = false;
let cameraX = 0;
let frameCount = 0;

// 键盘控制
const keys = { right: false, left: false, up: false };

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

// 游戏基础物理对象
class GameObject {
    constructor(x, y, w, h, type) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.type = type;
        this.vx = 0;
        this.vy = 0;
    }
    draw() {
        let s = SPRITE_MAP[this.type];
        if (s) {
            ctx.drawImage(spriteSheet, s.x, s.y, s.w, s.h, this.x - cameraX, this.y, this.w, this.h);
        } else {
            // 回退方案
            ctx.fillStyle = '#8b4513';
            ctx.fillRect(this.x - cameraX, this.y, this.w, this.h);
        }
    }
}

// 玩家类
class Player extends GameObject {
    constructor() {
        super(100, 300, 32, 32, 'mario_idle');
        this.grounded = false;
        this.facingRight = true;
        this.animFrame = 0;
    }
    update() {
        if (keys.right) {
            this.vx += 1;
            this.facingRight = true;
        } else if (keys.left) {
            this.vx -= 1;
            this.facingRight = false;
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

        if (this.x < 0) { this.x = 0; this.vx = 0; }
        if (this.y > CONFIG.canvasHeight) endGame('游戏结束');

        // 动画逻辑
        if (!this.grounded) {
            this.type = 'mario_jump';
        } else if (this.vx !== 0) {
            this.animFrame++;
            this.type = (Math.floor(this.animFrame / 10) % 2 === 0) ? 'mario_run1' : 'mario_run2';
        } else {
            this.type = 'mario_idle';
        }
    }
    draw() {
        let s = SPRITE_MAP[this.type] || SPRITE_MAP['mario_idle'];
        ctx.save();
        if (!this.facingRight) {
            ctx.translate(this.x - cameraX + this.w, this.y);
            ctx.scale(-1, 1);
            ctx.drawImage(charSheet, s.x, s.y, s.w, s.h, 0, 0, this.w, this.h);
        } else {
            ctx.drawImage(charSheet, s.x, s.y, s.w, s.h, this.x - cameraX, this.y, this.w, this.h);
        }
        ctx.restore();
    }
}

// 敌人类
class Enemy extends GameObject {
    constructor(x, y) {
        super(x, y, 32, 32, 'goomba1');
        this.dir = -1;
        this.speed = 1.5;
        this.animFrame = 0;
    }
    update() {
        this.x += this.dir * this.speed;
        this.animFrame++;
        this.type = (Math.floor(this.animFrame / 15) % 2 === 0) ? 'goomba1' : 'goomba2';
        
        // 简单碰撞检测让怪物在平台边缘折返（此处简化，仅做基础位移）
        platforms.forEach(p => {
            if (this.x < p.x && this.dir === -1 && this.y + this.h > p.y) this.dir = 1;
            if (this.x + this.w > p.x + p.w && this.dir === 1 && this.y + this.h > p.y) this.dir = -1;
        });
    }
    draw() {
        let s = SPRITE_MAP[this.type];
        ctx.drawImage(charSheet, s.x, s.y, s.w, s.h, this.x - cameraX, this.y, this.w, this.h);
    }
}

// 金币类
class Coin extends GameObject {
    constructor(x, y) {
        super(x, y, 24, 24, 'coin');
        this.collected = false;
    }
    draw() {
        if (!this.collected) {
            let s = SPRITE_MAP['coin'];
            ctx.drawImage(spriteSheet, s.x, s.y, s.w, s.h, this.x - cameraX, this.y, this.w, this.h);
        }
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
    // 地面
    for(let i=0; i<30; i++) {
        platforms.push(new GameObject(i * 40, 440, 40, 40, 'ground'));
    }
    
    // 砖块和障碍
    platforms.push(new GameObject(200, 320, 40, 40, 'brick'));
    platforms.push(new GameObject(240, 320, 40, 40, 'question'));
    platforms.push(new GameObject(280, 320, 40, 40, 'brick'));
    
    platforms.push(new GameObject(400, 240, 120, 40, 'brick'));
    
    // 水管 (由四部分组成)
    platforms.push(new GameObject(600, 400, 40, 40, 'pipe_top_left'));
    platforms.push(new GameObject(640, 400, 40, 40, 'pipe_top_right'));
    
    platforms.push(new GameObject(900, 360, 40, 40, 'pipe_top_left'));
    platforms.push(new GameObject(940, 360, 40, 40, 'pipe_top_right'));
    platforms.push(new GameObject(900, 400, 40, 40, 'pipe_left'));
    platforms.push(new GameObject(940, 400, 40, 40, 'pipe_right'));
    
    coins = [
        new Coin(250, 280),
        new Coin(450, 200),
        new Coin(630, 360),
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

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 背景色
    ctx.fillStyle = '#5c94fc'; // 经典马里奥蓝天
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    player.update();
    
    if (player.x > CONFIG.canvasWidth / 2) {
        cameraX = player.x - CONFIG.canvasWidth / 2;
    }

    platforms.forEach(p => {
        const side = checkCollision(player, p);
        if (side === 'top') {
            player.vy = 0;
            player.grounded = true;
        } else if (side === 'bottom') {
            player.vy *= -1;
        } else if (side === 'let, CONFIG.tileWidth, CONFIG.tileHeight, 'pipe_right'));
    }
}

function gameLoop() {
    if (gameOver) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 背景
    ctx.fillStyle = '#5c94fc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    player.update();
    
    // 相机跟随
    if (player.x > CONFIG.canvasWidth / 2) {
        cameraX = player.x - CONFIG.canvasWidth / 2;
    }

    platforms.forEach(p => {
        const side = checkCollision(player, p);
        if (side === 'top') {
            player.vy = 0;
            player.grounded = true;
        } else if (side === 'bottom') {
            player.vy = 2; // 被弹下来
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
            player.vy = -12;
            score += 100;
            scoreEl.innerText = score;
        } else if (side) {
            endGame('马里奥阵亡了');
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

    if (player.x > 3000) {
        endGame('通关成功！', true);
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

       