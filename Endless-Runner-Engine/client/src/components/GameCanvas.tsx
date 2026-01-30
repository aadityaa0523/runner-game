import { useEffect, useRef, useState } from 'react';
import { useSubmitScore } from '@/hooks/use-scores';
import { motion, AnimatePresence } from 'framer-motion';

// --- GAME CONSTANTS ---
const LANE_COUNT = 3;
const LANE_WIDTH_RATIO = 0.6; // Width of road relative to screen
const HORIZON_Y = 0.3; // Horizon line height (0-1)
const GRAVITY = 0.6;
const JUMP_FORCE = -15;
const GROUND_Y_RATIO = 0.85; // Where player feet touch ground
const SPEED_INITIAL = 12;
const SPEED_INCREMENT = 0.005;

type GameState = 'start' | 'playing' | 'gameover';

interface Player {
  lane: number; // 0, 1, 2
  y: number;
  vy: number;
  isJumping: boolean;
  stumbleCooldown: number;
}

interface Obstacle {
  lane: number;
  z: number; // Depth (100 = close, 0 = horizon)
  type: 'barrier' | 'train';
  passed: boolean;
}

interface Coin {
  lane: number;
  z: number;
  active: boolean;
  angle: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>('start');
  const [score, setScore] = useState(0);
  const [coins, setCoins] = useState(0);
  const submitScoreMutation = useSubmitScore();

  // --- GAME STATE REFS (Used inside animation loop) ---
  const stateRef = useRef({
    speed: SPEED_INITIAL,
    distance: 0,
    score: 0,
    coins: 0,
    player: { lane: 1, y: 0, vy: 0, isJumping: false, stumbleCooldown: 0 } as Player,
    policeDistance: 100, // 0 = caught, 100 = safe
    obstacles: [] as Obstacle[],
    items: [] as Coin[],
    particles: [] as Particle[],
    lastSpawnZ: 0,
    gameOver: false,
  });

  // --- CONTROLS ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== 'playing') return;
      const s = stateRef.current;
      
      switch(e.key) {
        case 'ArrowLeft': 
        case 'a':
          if (s.player.lane > 0) s.player.lane--; 
          break;
        case 'ArrowRight':
        case 'd':
          if (s.player.lane < LANE_COUNT - 1) s.player.lane++; 
          break;
        case 'ArrowUp':
        case 'w':
        case ' ':
          if (!s.player.isJumping) {
            s.player.vy = JUMP_FORCE;
            s.player.isJumping = true;
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  // --- MAIN GAME LOOP ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    // Resize handler
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    // Reset game state
    const resetGame = () => {
      stateRef.current = {
        speed: SPEED_INITIAL,
        distance: 0,
        score: 0,
        coins: 0,
        player: { lane: 1, y: 0, vy: 0, isJumping: false, stumbleCooldown: 0 },
        policeDistance: 100,
        obstacles: [],
        items: [],
        particles: [],
        lastSpawnZ: 0,
        gameOver: false,
      };
      setScore(0);
      setCoins(0);
    };

    if (gameState === 'start') resetGame();

    // Drawing Helpers
    const project = (x: number, y: number, z: number) => {
      // Perspective projection
      // z goes from 1000 (horizon) to 0 (camera)
      const scale = 1000 / (1000 - z);
      const px = (x - canvas.width/2) * scale + canvas.width/2;
      const py = (y - canvas.height/2) * scale + canvas.height/2;
      return { x: px, y: py, scale };
    };

    const drawPolygon = (points: {x: number, y: number}[], color: string) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
      ctx.closePath();
      ctx.fill();
    };
    
    // Game Loop
    const loop = () => {
      if (stateRef.current.gameOver) return;

      const s = stateRef.current;
      const w = canvas.width;
      const h = canvas.height;
      const horizonY = h * HORIZON_Y;
      const groundY = h * GROUND_Y_RATIO;

      // Update State
      if (gameState === 'playing') {
        s.speed += SPEED_INCREMENT;
        s.distance += s.speed;
        s.score = Math.floor(s.distance / 10);
        setScore(s.score);
        setCoins(s.coins);

        // Player Physics
        if (s.player.isJumping) {
          s.player.y += s.player.vy;
          s.player.vy += GRAVITY;
          if (s.player.y >= 0) {
            s.player.y = 0;
            s.player.isJumping = false;
          }
        }

        // Police Catchup Logic
        if (s.policeDistance < 100) s.policeDistance += 0.2; // Slowly recovers
        if (s.policeDistance <= 0) {
          s.gameOver = true;
          setGameState('gameover');
        }

        // Spawning
        if (s.distance - s.lastSpawnZ > 800) {
           s.lastSpawnZ = s.distance;
           const lane = Math.floor(Math.random() * 3);
           const type = Math.random() > 0.7 ? 'train' : 'barrier';
           s.obstacles.push({ 
             lane, 
             z: 2000, // Starts far away
             type, 
             passed: false 
           });
           
           // Spawn coins in other lanes
           const coinLane = (lane + 1) % 3;
           s.items.push({ lane: coinLane, z: 2000, active: true, angle: 0 });
           s.items.push({ lane: coinLane, z: 2150, active: true, angle: 0 });
           s.items.push({ lane: coinLane, z: 2300, active: true, angle: 0 });
        }

        // Update Objects
        s.obstacles.forEach(o => o.z -= s.speed);
        s.items.forEach(c => {
          c.z -= s.speed;
          c.angle += 0.1;
        });
        
        // Cleanup off-screen
        s.obstacles = s.obstacles.filter(o => o.z > -200);
        s.items = s.items.filter(i => i.z > -200);

        // Collision Detection
        // Simple bounding box for z-depth
        const playerZ = 100; // Player is conceptually at z=100 from camera
        
        s.obstacles.forEach(o => {
          if (!o.passed && o.z < 250 && o.z > 50) { // Near player depth
            if (o.lane === s.player.lane) {
              // Hit!
              if (s.player.y < -50 && o.type === 'barrier') {
                // Jumped over barrier - OK
              } else {
                // CRASH
                o.passed = true;
                s.policeDistance -= 40; // Police gets closer
                s.player.stumbleCooldown = 20;
                // Add shake or flash effect here
              }
            }
          }
        });

        s.items.forEach(c => {
           if (c.active && c.z < 150 && c.z > 50 && c.lane === s.player.lane) {
             if (s.player.y > -100) { // Must be near ground or mid-jump to collect
               c.active = false;
               s.coins++;
               // Sparkle particles
               for(let i=0; i<5; i++) {
                 s.particles.push({
                   x: w * (0.5 + (c.lane - 1)*0.2), // Rough approx
                   y: h * 0.7, 
                   vx: (Math.random()-0.5)*10,
                   vy: (Math.random()-0.5)*10,
                   life: 1.0,
                   color: '#FFD700'
                 });
               }
             }
           }
        });
        
        // Update particles
        s.particles.forEach(p => {
          p.x += p.vx;
          p.y += p.vy;
          p.life -= 0.05;
        });
        s.particles = s.particles.filter(p => p.life > 0);
      }

      // --- RENDER ---
      
      // 1. SKY & GROUND
      const gradient = ctx.createLinearGradient(0, 0, 0, h);
      gradient.addColorStop(0, '#00B4DB'); // Deep Cyan
      gradient.addColorStop(HORIZON_Y, '#B2FEFA'); // Light Cyan at horizon
      gradient.addColorStop(HORIZON_Y, '#6DD5FA'); // Ground Color (top)
      gradient.addColorStop(1, '#2980B9'); // Ground Color (bottom)
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);

      // Draw Sun
      ctx.fillStyle = '#FFD700';
      ctx.shadowBlur = 40;
      ctx.shadowColor = '#FFD700';
      ctx.beginPath();
      ctx.arc(w*0.8, h*0.15, 60, 0, Math.PI*2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Draw Grid on Ground for speed illusion
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const gridOffset = (s.distance % 200) / 200; // 0 to 1 loop
      // Horizontal lines moving
      for (let z=0; z<20; z++) {
         const pz = (10 - z + gridOffset) * 100; // z depth
         if (pz < 1000 && pz > 0) {
           const p1 = project(-1000, 0, pz);
           const p2 = project(1000, 0, pz);
           // Adjust y for ground plane (simple trick: map z to y below horizon)
           const y = horizonY + (h-horizonY) * (1 - pz/1000); 
           ctx.moveTo(0, y);
           ctx.lineTo(w, y);
         }
      }
      ctx.stroke();

      // 2. LANES
      // Draw 3 lanes converging to horizon
      // Horizon point: (w/2, horizonY)
      // Bottom points: (w/2 - laneWidth*1.5, h), etc.
      const laneBottomWidth = w * LANE_WIDTH_RATIO;
      const roadColor = '#5D6D7E';
      const laneLineColor = '#AED6F1';
      
      // Draw road base
      ctx.fillStyle = roadColor;
      ctx.beginPath();
      ctx.moveTo(w/2, horizonY);
      ctx.lineTo(w/2 - laneBottomWidth, h);
      ctx.lineTo(w/2 + laneBottomWidth, h);
      ctx.fill();
      
      // Draw lane markers
      ctx.strokeStyle = laneLineColor;
      ctx.lineWidth = 4;
      ctx.setLineDash([20, 30]);
      ctx.lineDashOffset = -s.distance; // Animate lines
      ctx.beginPath();
      // Left lane divider
      ctx.moveTo(w/2, horizonY);
      ctx.lineTo(w/2 - laneBottomWidth * 0.33, h);
      // Right lane divider
      ctx.moveTo(w/2, horizonY);
      ctx.lineTo(w/2 + laneBottomWidth * 0.33, h);
      ctx.stroke();
      ctx.setLineDash([]);

      // 3. OBSTACLES & COINS (Sort by Z far to near to handle occlusion correctly-ish)
      const renderList = [
        ...s.obstacles.map(o => ({...o, kind: 'obstacle'})),
        ...s.items.map(i => ({...i, kind: 'coin'}))
      ].sort((a, b) => b.z - a.z);

      renderList.forEach(obj => {
        // Calculate screen position
        // Map logical Z (2000 to -200) to visual Y
        // Simple perspective projection for objects
        // We need X based on lane (-1, 0, 1)
        
        const scale = 300 / (300 + obj.z); // Perspective factor
        const laneX = (obj.lane - 1) * (w * 0.4); // -1, 0, 1 spread
        const screenX = w/2 + laneX * scale;
        const screenY = horizonY + (h - horizonY) * 0.8 * scale * 1.5; // Approximate ground level for z
        
        // Don't draw if behind camera or too far
        if (scale < 0 || scale > 2) return;

        if (obj.kind === 'obstacle') {
           const size = 150 * scale;
           const o = obj as unknown as Obstacle;
           
           if (o.type === 'barrier') {
             // Red Barrier
             ctx.fillStyle = '#E74C3C';
             ctx.strokeStyle = '#922B21';
             ctx.lineWidth = 4 * scale;
             ctx.fillRect(screenX - size/2, screenY - size, size, size);
             ctx.strokeRect(screenX - size/2, screenY - size, size, size);
             // Caution stripes
             ctx.fillStyle = '#F1C40F';
             ctx.beginPath();
             ctx.moveTo(screenX - size/2, screenY - size);
             ctx.lineTo(screenX, screenY);
             ctx.lineTo(screenX + 20*scale, screenY);
             ctx.lineTo(screenX - size/2 + 20*scale, screenY - size);
             ctx.fill();
           } else {
             // Train/Block (taller)
             const tHeight = size * 1.5;
             ctx.fillStyle = '#34495E';
             ctx.fillRect(screenX - size/2, screenY - tHeight, size, tHeight);
             // Windows
             ctx.fillStyle = '#85C1E9';
             ctx.fillRect(screenX - size*0.3, screenY - tHeight*0.8, size*0.6, size*0.3);
           }
        } else {
           // Coin
           const c = obj as unknown as Coin;
           if (!c.active) return;
           const size = 60 * scale;
           const floatY = Math.sin(c.angle) * 20 * scale;
           
           ctx.save();
           ctx.translate(screenX, screenY - size - 50*scale + floatY);
           // ctx.rotate(c.angle); // Spin 2D
           ctx.scale(Math.cos(c.angle), 1); // Spin effect via scaling X
           
           ctx.fillStyle = '#F1C40F';
           ctx.beginPath();
           ctx.arc(0, 0, size/2, 0, Math.PI*2);
           ctx.fill();
           
           ctx.strokeStyle = '#D4AC0D';
           ctx.lineWidth = 3 * scale;
           ctx.stroke();
           
           ctx.fillStyle = '#F9E79F'; // Shine
           ctx.font = `bold ${size*0.6}px sans-serif`;
           ctx.textAlign = 'center';
           ctx.textBaseline = 'middle';
           ctx.fillText('$', 0, 2);
           
           ctx.restore();
        }
      });

      // 4. PLAYER
      const pScale = 1.0; // Player scale is constant-ish as they stay at same Z plane relative to camera
      const pX = w/2 + (s.player.lane - 1) * (w * 0.3) * (1 - (s.player.stumbleCooldown > 0 ? 0.05 : 0)); // Slight shift on stumble
      const pY = groundY + s.player.y;
      
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(pX, groundY, 40 * (1 + s.player.y/200), 10, 0, 0, Math.PI*2); // Shrink shadow on jump
      ctx.fill();

      // Draw Player (Cartoon Character)
      ctx.save();
      ctx.translate(pX, pY);
      if (s.player.stumbleCooldown > 0) {
        ctx.rotate((Math.random()-0.5) * 0.2); // Shake
        ctx.fillStyle = 'red'; // Flash red
      }
      
      // Body
      ctx.fillStyle = '#2ECC71'; // Bright Green Shirt
      ctx.beginPath();
      ctx.roundRect(-25, -90, 50, 60, 10);
      ctx.fill();
      
      // Head
      ctx.fillStyle = '#F5CBA7'; // Skin
      ctx.beginPath();
      ctx.arc(0, -110, 25, 0, Math.PI*2);
      ctx.fill();
      
      // Legs (Running anim)
      const runCycle = Math.sin(s.distance / 20);
      ctx.strokeStyle = '#283747'; // Pants
      ctx.lineWidth = 12;
      ctx.lineCap = 'round';
      
      ctx.beginPath(); // Leg 1
      ctx.moveTo(-10, -30);
      ctx.lineTo(-15 + runCycle*20, -5);
      ctx.stroke();

      ctx.beginPath(); // Leg 2
      ctx.moveTo(10, -30);
      ctx.lineTo(15 - runCycle*20, -5);
      ctx.stroke();
      
      ctx.restore();

      // 5. POLICE CHASE (Indicator)
      if (s.policeDistance < 80) {
        const sirenAlpha = (Math.sin(Date.now() / 100) + 1) / 2;
        ctx.fillStyle = `rgba(231, 76, 60, ${sirenAlpha * 0.3})`;
        ctx.fillRect(0, 0, w, h);
        
        // Draw chaser behind player if very close
        if (s.policeDistance < 40) {
           const policeY = groundY - 20;
           const policeX = pX; // Chasing directly behind
           const policeScale = 0.8;
           
           ctx.save();
           ctx.translate(policeX, policeY);
           // Simple Blue Police Car/Person shape
           ctx.fillStyle = '#2E86C1';
           ctx.fillRect(-30, -70, 60, 50);
           // Siren Light
           ctx.fillStyle = sirenAlpha > 0.5 ? 'red' : 'blue';
           ctx.beginPath();
           ctx.arc(0, -80, 10, 0, Math.PI*2);
           ctx.fill();
           ctx.restore();
        }
      }

      // 6. PARTICLES
      s.particles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI*2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      });

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(animationFrameId);
  }, [gameState]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-black select-none">
      <canvas ref={canvasRef} id="game-canvas" />

      {/* START SCREEN */}
      {gameState === 'start' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm z-10">
          <motion.h1 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-8xl text-primary font-display mb-8 text-stroke text-white drop-shadow-[0_10px_0_rgba(0,0,0,0.5)] rotate-[-5deg]"
          >
            CANVAS RUNNER
          </motion.h1>
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          >
            <button 
              onClick={() => setGameState('playing')}
              className="btn-game bg-secondary text-secondary-foreground text-4xl"
            >
              TAP TO START
            </button>
          </motion.div>
          <p className="mt-8 text-white font-bold text-xl drop-shadow-md">
            ARROWS / WASD to Move & Jump
          </p>
        </div>
      )}

      {/* HUD */}
      {gameState !== 'start' && (
        <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start pointer-events-none">
          <div className="flex flex-col">
            <div className="text-4xl font-display text-white text-stroke drop-shadow-lg">
              {score.toString().padStart(6, '0')}
            </div>
            <div className="text-sm font-bold text-white/80 uppercase tracking-widest">Score</div>
          </div>
          
          <div className="flex items-center gap-3 bg-black/30 px-4 py-2 rounded-full backdrop-blur-md border border-white/20">
            <div className="w-8 h-8 rounded-full bg-secondary border-2 border-secondary-foreground flex items-center justify-center text-xs font-bold shadow-inner">
              $
            </div>
            <span className="text-2xl font-display text-secondary text-stroke-sm">
              {coins}
            </span>
          </div>
        </div>
      )}

      {/* GAME OVER */}
      <AnimatePresence>
        {gameState === 'gameover' && (
          <GameOverOverlay score={score} coins={coins} onRestart={() => setGameState('start')} />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- SUB-COMPONENTS ---

function GameOverOverlay({ score, coins, onRestart }: { score: number, coins: number, onRestart: () => void }) {
  const [username, setUsername] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const submit = useSubmitScore();

  const handleSubmit = () => {
    if (!username) return;
    submit.mutate({ username, score, coins }, {
      onSuccess: () => setSubmitted(true)
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4"
    >
      <motion.div 
        initial={{ scale: 0.8, y: 50 }}
        animate={{ scale: 1, y: 0 }}
        className="glass-panel p-8 max-w-md w-full text-center relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-4 bg-gradient-to-r from-red-500 to-orange-500" />
        
        <h2 className="text-6xl font-display text-destructive text-stroke mb-2 rotate-2">BUSTED!</h2>
        <p className="text-muted-foreground font-bold uppercase tracking-widest mb-8">The police caught you</p>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-blue-50 p-4 rounded-xl border-2 border-blue-100">
            <div className="text-xs text-blue-400 uppercase font-bold">Distance</div>
            <div className="text-4xl font-display text-blue-600">{score}m</div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-xl border-2 border-yellow-100">
            <div className="text-xs text-yellow-500 uppercase font-bold">Coins</div>
            <div className="text-4xl font-display text-yellow-600">{coins}</div>
          </div>
        </div>

        {!submitted ? (
          <div className="space-y-4 mb-8">
            <input
              autoFocus
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="ENTER NAME"
              className="w-full text-center text-2xl font-display uppercase bg-slate-100 border-2 border-slate-200 rounded-xl py-3 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
              maxLength={10}
            />
            <button 
              onClick={handleSubmit}
              disabled={!username || submit.isPending}
              className="w-full btn-game bg-primary text-primary-foreground text-xl py-3"
            >
              {submit.isPending ? 'SAVING...' : 'SAVE SCORE'}
            </button>
          </div>
        ) : (
          <div className="bg-green-100 text-green-700 p-4 rounded-xl font-bold mb-8 animate-pulse border-2 border-green-200">
            SCORE SAVED!
          </div>
        )}

        <button 
          onClick={onRestart}
          className="text-muted-foreground hover:text-foreground font-bold underline decoration-2 underline-offset-4 uppercase tracking-wider transition-colors"
        >
          Play Again
        </button>
      </motion.div>
    </motion.div>
  );
}
