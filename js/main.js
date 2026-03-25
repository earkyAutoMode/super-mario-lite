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
    colors: {
        player: '#ff4444', // 红色马里奥
        enemy: '#8b4513',  // 棕色板栗仔
        ground: '#73c33d', // 绿色地面
        brick: '#8b4513',  // 棕色砖块
        coin: '#ffd700',   // 金色金币
        pipe: '#00aa00'    // 绿色水管
    }
};

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const statusText = document.getElementById('status-text');
const overlay = document.getElementById('overlay');

canvas.width = CONFIG.canvasWidth;
canvas.height = CONFIG.canvasHeight;

let score = 0;
let gameOver = false;
let gameWon = false;
let cameraX = 0;

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

// 基础物理对象类
class GameObject {
    constructor(x, y, w, h, color) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.color = color;
        this.vx = 0;
        this.vy = 0;
    }
    draw() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - cameraX, this.y, this.w, this.h);
    }
}

// 玩家类
class Player extends GameObject {
    constructor() {
        super(100, 300, 32, 32, CONFIG.colors.player);
        this.grounded = false;
    }
    update() {
        // 水平移动
        if (keys.right) this.vx += 1;
        if (keys.left) this.vx -= 1;
        
        this.vx *= CONFIG.friction;
        if (Math.abs(this.vx) < 0.1) this.vx = 0;
        this.vx = Math.max(-CONFIG.moveSpeed, Math.min(CONFIG.moveSpeed, this.vx));
        
        this.x += this.vx;

        // 跳跃和重力
        if (keys.up && this.grounded) {
            this.vy = CONFIG.jumpStrength;
            this.grounded = false;
        }
        
        this.vy += CONFIG.gravity;
        this.y += this.vy;
        
        this.grounded = false; // 假设没在地板上，碰撞检测会重置

        // 边界限制
        if (this.x < 0) {
            this.x = 0;
            this.vx = 0;
        }
        
        // 掉出屏幕游戏结束
        if (this.y > CONFIG.canvasHeight) {
            endGame('游戏结束');
        }
    }
}

// 敌人类 (板栗仔)
class Enemy extends GameObject {
    constructor(x, y) {
        super(x, y, 32, 32, CONFIG.colors.enemy);
        this.dir = -1;
        this.speed = 1.5;
    }
    update() {
        this.x += this.dir * this.speed;
        
        // 简单的障碍物转向判定
        platforms.forEach(p => {
            if (this.collidesWith(p)) {
                this.dir *= -1;
                this.x += this.dir * this.speed;
            }
        });
    }
    collidesWith(o) {
        return this.x < o.x + o.w && this.x + this.w > o.x &&
               this.y < o.y + o.h && this.y + this.h > o.y;
    }
}

// 关卡元素类 (金币)
class Coin extends GameObject {
    constructor(x, y) {
        super(x, y, 20, 20, CONFIG.colors.coin);
        this.collected = false;
    }
    draw() {
        if (this.collected) return;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x + this.w/2 - cameraX, this.y + this.h/2, this.w/2, 0, Math.PI * 2);
        ctx.fill();
    }
}

// 游戏状态
let player, platforms, coins, enemies;

function init() {
    score = 0;
    scoreEl.innerText = score;
    gameOver = false;
    gameWon = false;
    cameraX = 0;
    overlay.classList.add('hidden');
    
    player = new Player();
    
    // 生成简单关卡
    platforms = [];
    // 地面
    platforms.push(new GameObject(0, 440, 1000, 40, CONFIG.colors.ground));
    platforms.push(new GameObject(1100, 440, 2000, 40, CONFIG.colors.ground)); // 地缝
    
    // 砖块和障碍
    platforms.push(new GameObject(200, 320, 120, 40, CONFIG.colors.brick));
    platforms.push(new GameObject(400, 240, 120, 40, CONFIG.colors.brick));
    platforms.push(new GameObject(600, 400, 80, 40, CONFIG.colors.pipe)); // 水管
    platforms.push(new GameObject(900, 360, 40, 80, CONFIG.colors.pipe));
    
    // 金币
    coins = [
        new Coin(250, 280),
        new Coin(450, 200),
        new Coin(630, 360),
        new Coin(1200, 400)
    ];
    
    // 敌人
    enemies = [
        new Enemy(500, 408),
        new Enemy(1300, 408)
    ];

    requestAnimationFrame(gameLoop);
}

function gameLoop() {
    if (gameOver) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 更新
    player.update();
    
    // 摄像机平滑跟随
    if (player.x > CONFIG.canvasWidth / 2) {
        cameraX = player.x - CONFIG.canvasWidth / 2;
    }

    // 碰撞检测与渲染
    platforms.forEach(p => {
        const side = checkCollision(player, p);
        if (side === 'top') {
            player.vy = 0;
            player.grounded = true;
        } else if (side === 'bottom') {
            player.vy *= -1;
        } else if (side === 'left' || side === 'right') {
            player.vx = 0;
        }
        p.draw();
    });

    // 敌人更新与碰撞
    enemies.forEach((e, idx) => {
        e.update();
        const side = checkCollision(player, e);
        if (side === 'top') {
            enemies.splice(idx, 1);
            player.vy = -10; // 踩中反弹
            score += 100;
            scoreEl.innerText = score;
        } else if (side) {
            endGame('游戏结束');
        }
        e.draw();
    });

    // 金币收集
    coins.forEach(c => {
        if (!c.collected && checkCollision(player, c)) {
            c.collected = true;
            score += 50;
            scoreEl.innerText = score;
        }
        c.draw();
    });

    player.draw();

    // 胜利条件
    if (player.x > 2500) {
        endGame('通关大吉！', true);
    }

    requestAnimationFrame(gameLoop);
}

// AABB 碰撞检测
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

// 启动游戏
init();
