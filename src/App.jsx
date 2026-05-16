import React, { useState, useEffect, useRef } from 'react';
import { Peer } from 'peerjs';
import './index.css';

const ARENA_WIDTH = 1400;
const ARENA_HEIGHT = 800;
const PLAYER_SIZE = 40;
const SPEED = 6;
const MAX_CAPACITY = 5;
const START_TIME = 15;
const INTERACTION_DISTANCE = 60; 
const SHELTER_POS = { x: 700, y: 400, radius: 100 };

const ITEM_TYPES = [
  { id: 'child', name: 'Çocuk', size: 3, icon: '🧒', spawn: [1, 1] },
  { id: 'spouse', name: 'Eş', size: 3, icon: '🧑', spawn: [1, 1] },
  { id: 'water', name: 'Su Şişesi', size: 1, icon: '💧', spawn: [6, 8] }, 
  { id: 'soup', name: 'Çorba', size: 1, icon: '🥫', spawn: [6, 8] },     
  { id: 'radio', name: 'Radyo', size: 1, icon: '📻', spawn: [1, 2] },
  { id: 'medkit', name: 'İlk Yardım', size: 2, icon: '🩹', spawn: [1, 2] },
  { id: 'axe', name: 'Balta', size: 2, icon: '🪓', spawn: [1, 1] },
  { id: 'mask', name: 'Gaz Maskesi', size: 1, icon: '🤿', spawn: [1, 2] },
  { id: 'gun', name: 'Silah', size: 2, icon: '🔫', spawn: [1, 1] },
  { id: 'ammo', name: 'Mermi', size: 1, icon: '🔘', spawn: [2, 3] },
];

function App() {
  const [gameState, setGameState] = useState('start'); 
  const gameStateRef = useRef('start'); // Stale closure sorununu önlemek için ref
  
  // gameState değişince ref'i de güncelle
  const setGameStateSafe = (newState) => {
    gameStateRef.current = newState;
    setGameState(newState);
  };

  // Multiplayer Stateleri
  const [isMultiplayer, setIsMultiplayer] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [peerId, setPeerId] = useState('');
  const [joinId, setJoinId] = useState('');
  const [conn, setConn] = useState(null);
  
  const [localReady, setLocalReady] = useState(false);
  const [remoteReady, setRemoteReady] = useState(false);

  // Phase 1 Stateleri
  const [timeLeft, setTimeLeft] = useState(START_TIME);
  const [inventory, setInventory] = useState([]);
  const [itemsOnMap, setItemsOnMap] = useState([]);
  const [capacityWarning, setCapacityWarning] = useState(false);
  
  const [playerPos, setPlayerPos] = useState({ x: 100, y: 100 });
  const [remotePlayerPos, setRemotePlayerPos] = useState({ x: 100, y: 100 });

  const playerRef = useRef({ x: 100, y: 100 });
  const remotePlayerRef = useRef({ x: 100, y: 100 });
  const keysRef = useRef({ w: false, a: false, s: false, d: false, e: false });
  const inventoryRef = useRef([]);
  const itemsOnMapRef = useRef([]);
  const shelterItemsRef = useRef([]);
  const requestRef = useRef();

  // Phase 2 Stateleri
  const [day, setDay] = useState(1);
  const [survivors, setSurvivors] = useState([]);
  const [supplies, setSupplies] = useState({ soup: 0, water: 0, medkit: 0, radio: 0, axe: 0, mask: 0, gun: 0, ammo: 0 });
  const [logs, setLogs] = useState([]);
  const [eventModal, setEventModal] = useState(null);

  /* =========================================================
     MULTIPLAYER BAĞLANTI (PEERJS)
     ========================================================= */
  const generateShortId = () => Math.random().toString(36).substring(2, 6).toUpperCase();

  const hostRoom = () => {
    setIsMultiplayer(true);
    setIsHost(true);
    const customId = 'ODA-' + generateShortId();
    const peer = new Peer(customId);
    peer.on('open', (id) => setPeerId(id));
    peer.on('connection', (connection) => {
      setConn(connection);
      // Bağlantı kurulduğunda host oyunu başlatır
      connection.on('open', () => {
        setTimeout(() => startGame(true, connection), 1000);
      });
      setupConnListeners(connection);
    });
  };

  const joinRoom = () => {
    if (!joinId) return;
    setIsMultiplayer(true);
    setIsHost(false);
    const peer = new Peer();
    peer.on('open', () => {
      const connection = peer.connect(joinId);
      setConn(connection);
      setupConnListeners(connection);
    });
  };

  const setupConnListeners = (connection) => {
    connection.on('data', (data) => {
      if (data.type === 'pos') {
        remotePlayerRef.current = { x: data.x, y: data.y };
        setRemotePlayerPos({ x: data.x, y: data.y });
      } 
      else if (data.type === 'start') {
        itemsOnMapRef.current = data.items;
        setItemsOnMap(data.items);
        setGameStateSafe('playing');
        setTimeLeft(START_TIME);
      } 
      else if (data.type === 'item_picked') {
        itemsOnMapRef.current = itemsOnMapRef.current.filter(i => i.uid !== data.uid);
        setItemsOnMap([...itemsOnMapRef.current]);
      } 
      else if (data.type === 'shelter_enter') {
        shelterItemsRef.current = [...shelterItemsRef.current, ...data.inv];
      }
      else if (data.type === 'survival_sync') {
        setSupplies(data.supplies);
        setSurvivors(data.survivors);
        setDay(data.day);
        setLogs(data.logs);
        setGameStateSafe('survival');
      }
      else if (data.type === 'state_sync') {
        setSupplies(data.supplies);
        setSurvivors(data.survivors);
        setDay(data.day);
        setLogs(data.logs);
        setEventModal(data.eventModal);
        setLocalReady(false);
        setRemoteReady(false);
      }
      else if (data.type === 'action') {
        if (data.action === 'feed') executeActionLocally('feed', data.id);
        if (data.action === 'water') executeActionLocally('water', data.id);
        if (data.action === 'heal') executeActionLocally('heal', data.id);
        if (data.action === 'expedition') executeActionLocally('expedition', data.id);
        if (data.action === 'eventChoice') executeEventChoiceLocally(data.choiceIdx);
      }
      else if (data.type === 'ready') {
        setRemoteReady(true);
      }
      else if (data.type === 'gameover') {
        setGameStateSafe('gameover');
      }
    });
  };

  /* =========================================================
     PHASE 1 (TOPLAMA MANTIKLARI)
     ========================================================= */
  const generateItems = () => {
    const generated = [];
    ITEM_TYPES.forEach(type => {
      const min = type.spawn[0];
      const max = type.spawn[1];
      const count = Math.floor(Math.random() * (max - min + 1)) + min;
      for (let i = 0; i < count; i++) {
        let rx, ry;
        do {
          rx = Math.random() * (ARENA_WIDTH - 100) + 50;
          ry = Math.random() * (ARENA_HEIGHT - 100) + 50;
        } while (Math.hypot(rx - SHELTER_POS.x, ry - SHELTER_POS.y) < SHELTER_POS.radius + 50);

        generated.push({ uid: `${type.id}-${i}-${Date.now()}`, ...type, x: rx, y: ry });
      }
    });
    return generated;
  };

  const startGame = (isMplayer = false, c = conn) => {
    const initialItems = generateItems();
    itemsOnMapRef.current = initialItems;
    setItemsOnMap(initialItems);
    inventoryRef.current = [];
    setInventory([]);
    shelterItemsRef.current = [];
    playerRef.current = { x: 100, y: 100 };
    setPlayerPos({ x: 100, y: 100 });
    setCapacityWarning(false);
    setGameStateSafe('playing');
    setTimeLeft(START_TIME);

    if (isMplayer && c) {
      c.send({ type: 'start', items: initialItems });
    }
  };

  // Tek Oyunculu Başlangıç
  const startSinglePlayer = () => {
    setIsMultiplayer(false);
    startGame();
  };

  useEffect(() => {
    let timerId;
    if (gameState === 'playing' && (!isMultiplayer || isHost)) {
      timerId = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerId);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      clearInterval(timerId);
    };
  }, [gameState, isMultiplayer, isHost]);

  useEffect(() => {
    // Saniye bittiğinde host veya single player kontrolü ele alır
    if (timeLeft === 0 && gameState === 'playing' && (!isMultiplayer || isHost)) {
      setTimeout(() => checkPhase1End(), 500); // Gecikme ile ağ senkronizasyonunu bekle
    }
  }, [timeLeft, gameState]);

  const checkPhase1End = () => {
    // Zaten oyun bitmişse tekrar tetiklenmesin
    if (gameStateRef.current !== 'playing') return;

    const dist = Math.hypot(playerRef.current.x - SHELTER_POS.x, playerRef.current.y - SHELTER_POS.y);
    const hostInShelter = dist <= SHELTER_POS.radius + 20;

    let clientInShelter = false;
    if (isMultiplayer) {
      const cDist = Math.hypot(remotePlayerRef.current.x - SHELTER_POS.x, remotePlayerRef.current.y - SHELTER_POS.y);
      clientInShelter = cDist <= SHELTER_POS.radius + 20;
    }

    if (hostInShelter || clientInShelter) {
      setupSurvival();
    } else {
      setGameStateSafe('gameover');
      if (conn) conn.send({ type: 'gameover' });
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();
      if (keysRef.current.hasOwnProperty(key)) keysRef.current[key] = true;
    };
    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase();
      if (keysRef.current.hasOwnProperty(key)) keysRef.current[key] = false;
    };
    if (gameState === 'playing') {
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState]);

  const handleControlStart = (key) => { keysRef.current[key] = true; };
  const handleControlEnd = (key) => { keysRef.current[key] = false; };

  const updateGame = () => {
    // Ref kullanarak her zaman güncel gameState'e bakıyoruz (stale closure önlemi)
    if (gameStateRef.current !== 'playing') return;

    let { x, y } = playerRef.current;
    const keys = keysRef.current;

    let moved = false;
    if (keys.w) { y -= SPEED; moved = true; }
    if (keys.s) { y += SPEED; moved = true; }
    if (keys.a) { x -= SPEED; moved = true; }
    if (keys.d) { x += SPEED; moved = true; }

    x = Math.max(PLAYER_SIZE/2, Math.min(ARENA_WIDTH - PLAYER_SIZE/2, x));
    y = Math.max(PLAYER_SIZE/2, Math.min(ARENA_HEIGHT - PLAYER_SIZE/2, y));

    playerRef.current = { x, y };
    setPlayerPos({ x, y }); 

    if (moved && conn) {
      conn.send({ type: 'pos', x, y });
    }

    let closestItem = null;
    let minDistance = INTERACTION_DISTANCE;

    itemsOnMapRef.current.forEach(item => {
      const dist = Math.hypot(item.x - x, item.y - y);
      if (dist < minDistance) {
        minDistance = dist;
        closestItem = item;
      }
    });

    if (keys.e && closestItem) {
      keys.e = false; 
      const usedCap = inventoryRef.current.reduce((tot, i) => tot + i.size, 0);
      if (usedCap + closestItem.size <= MAX_CAPACITY) {
        inventoryRef.current = [...inventoryRef.current, closestItem];
        itemsOnMapRef.current = itemsOnMapRef.current.filter(i => i.uid !== closestItem.uid);
        setInventory([...inventoryRef.current]);
        setItemsOnMap([...itemsOnMapRef.current]);
        setCapacityWarning(false);
        if (conn) conn.send({ type: 'item_picked', uid: closestItem.uid });
      } else {
        setCapacityWarning(true);
        setTimeout(() => setCapacityWarning(false), 2000);
      }
    }

    const distToShelter = Math.hypot(x - SHELTER_POS.x, y - SHELTER_POS.y);
    if (distToShelter <= SHELTER_POS.radius) {
      if (inventoryRef.current.length > 0) {
        shelterItemsRef.current = [...shelterItemsRef.current, ...inventoryRef.current];
        if (conn && !isHost) conn.send({ type: 'shelter_enter', inv: [...inventoryRef.current] });
        inventoryRef.current = [];
        setInventory([]);
      }
    }
    requestRef.current = requestAnimationFrame(updateGame);
  };

  useEffect(() => {
    if (gameState === 'playing') {
      requestRef.current = requestAnimationFrame(updateGame);
    }
    return () => {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    };
  }, [gameState]);


  /* =========================================================
     PHASE 2 (SURVIVAL MANTIKLARI)
     ========================================================= */

  const setupSurvival = () => {
    // Sadece Host burayı çalıştırıp Client'a yollar. Single ise direkt çalışır.
    if (isMultiplayer && !isHost) return; 

    const saved = shelterItemsRef.current;
    
    const survs = [{
      id: 'me', name: isMultiplayer ? 'Oyuncu 1' : 'Sen', icon: '👤',
      isAlive: true, isSick: false, 
      needsFood: false, needsWater: false, 
      daysHungry: 0, daysThirsty: 0, daysSick: 0, 
      status: 'shelter', expeditionDays: 0
    }];

    if (isMultiplayer) {
      survs.push({ id: 'p2', name: 'Oyuncu 2', icon: '🧑‍🤝‍🧑', isAlive: true, isSick: false, needsFood: false, needsWater: false, daysHungry: 0, daysThirsty: 0, daysSick: 0, status: 'shelter', expeditionDays: 0 });
    }

    const hasChild = saved.some(i => i.id === 'child');
    const hasSpouse = saved.some(i => i.id === 'spouse');
    if (hasChild) survs.push({ id: 'child', name: 'Çocuk', icon: '🧒', isAlive: true, isSick: false, needsFood: false, needsWater: false, daysHungry: 0, daysThirsty: 0, daysSick: 0, status: 'shelter', expeditionDays: 0 });
    if (hasSpouse && !isMultiplayer) survs.push({ id: 'spouse', name: 'Eş', icon: '🧑', isAlive: true, isSick: false, needsFood: false, needsWater: false, daysHungry: 0, daysThirsty: 0, daysSick: 0, status: 'shelter', expeditionDays: 0 });

    const initialSupplies = { soup: 0, water: 0, medkit: 0, radio: 0, axe: 0, mask: 0, gun: 0, ammo: 0 };
    saved.forEach(item => {
      if (initialSupplies[item.id] !== undefined) initialSupplies[item.id]++;
    });
    
    setSupplies(initialSupplies);
    setSurvivors(survs);
    setDay(1);
    const initialLogs = ['Sığınağa ulaştınız. Kapı kapandı.'];
    setLogs(initialLogs);
    setGameStateSafe('survival');

    if (isMultiplayer && isHost && conn) {
      conn.send({ type: 'survival_sync', supplies: initialSupplies, survivors: survs, day: 1, logs: initialLogs });
    }
  };

  // State Senkronizasyonu (Her işlemden sonra host gönderir)
  const syncState = (newSupplies, newSurvivors, newDay, newLogs, newEventModal) => {
    setSupplies(newSupplies);
    setSurvivors(newSurvivors);
    setDay(newDay);
    setLogs(newLogs);
    setEventModal(newEventModal);
    setLocalReady(false);
    setRemoteReady(false);
    if (conn && isHost) {
      conn.send({ type: 'state_sync', supplies: newSupplies, survivors: newSurvivors, day: newDay, logs: newLogs, eventModal: newEventModal });
    }
  };

  const executeEventChoiceLocally = (idx) => {
    if(eventModal && eventModal.options[idx]) {
      eventModal.options[idx].action();
    }
  };

  const handleEventChoice = (idx) => {
    if (isMultiplayer && conn) conn.send({ type: 'action', action: 'eventChoice', choiceIdx: idx });
    executeEventChoiceLocally(idx);
  };

  // Ortak Event Aksiyonları
  const fireGun = () => {
    const newSup = { ...supplies, ammo: supplies.ammo - 1 };
    const newLogs = [`[Gün ${day}] Silahı ateşleyip haydutları korkutarak kaçırdınız! (-1 Mermi)`, ...logs];
    syncState(newSup, survivors, day, newLogs, null);
  };

  const hideFromBandits = () => {
    let newSup = { ...supplies };
    let newLogs = [...logs];
    if (Math.random() < 0.5) {
      newLogs.unshift(`[Gün ${day}] Haydutlar kapıyı kırdı ve erzak çaldılar! (-1 Çorba, -1 Su)`);
      newSup.soup = Math.max(0, newSup.soup - 1);
      newSup.water = Math.max(0, newSup.water - 1);
    } else {
      newLogs.unshift(`[Gün ${day}] Ses çıkarmadınız. Haydutlar kapıyı zorlayıp vazgeçtiler.`);
    }
    syncState(newSup, survivors, day, newLogs, null);
  };

  const tradeWithStranger = (accept) => {
    let newSup = { ...supplies };
    let newLogs = [...logs];
    if (accept) {
      newSup.water -= 1;
      newSup.ammo += 2;
      newLogs.unshift(`[Gün ${day}] Yaşlı adama su verdiniz. O da masaya 2 Mermi bıraktı.`);
    } else {
      newLogs.unshift(`[Gün ${day}] Yabancıya kapıyı açmadınız. Homurdanarak uzaklaştı.`);
    }
    syncState(newSup, survivors, day, newLogs, null);
  };

  const simpleAck = (msg) => {
    syncState(supplies, survivors, day, [`[Gün ${day}] ${msg}`, ...logs], null);
  };

  // Sonraki Gün
  const tryNextDay = () => {
    if (isMultiplayer) {
      setLocalReady(true);
      if (conn) conn.send({ type: 'ready' });
      if (remoteReady) processNextDay();
    } else {
      processNextDay();
    }
  };

  useEffect(() => {
    if (isMultiplayer && localReady && remoteReady && isHost) {
      processNextDay();
    }
  }, [localReady, remoteReady]);


  const processNextDay = () => {
    if (isMultiplayer && !isHost) return; // Client hesaplamaz, Host'tan bekler.

    let currentLog = [];
    let newSupplies = { ...supplies };
    const nextDayNum = day + 1;
    let newEvent = null;

    const eventChance = Math.random();
    if (eventChance < 0.25) {
      const eventType = Math.random();
      if (eventType < 0.3) {
        newSupplies.water += 1;
        newSupplies.soup += 1;
        newEvent = {
          title: 'Sürpriz Paket!',
          msg: 'Kapıya gizemli biri paket bırakmış! (+1 Su, +1 Çorba)',
          options: [{ label: 'Tamam', condition: true, action: () => simpleAck('Dışarıdan erzak yardımı geldi.') }]
        };
      } else if (eventType < 0.65) {
        newEvent = {
          title: 'Haydutlar Geldi!',
          msg: 'Yüzü maskeli adamlar kapıya vuruyor! İçeri girmeye çalışıyorlar.',
          options: [
            { label: 'Silahla Vur (-1 Mermi)', condition: newSupplies.gun > 0 && newSupplies.ammo > 0, action: fireGun, type: 'action' },
            { label: 'Sessiz Ol (Saklan)', condition: true, action: hideFromBandits, type: 'danger' }
          ]
        };
      } else {
        newEvent = {
          title: 'Yaşlı Bir Adam',
          msg: 'Bitkin düşmüş yaşlı bir adam kapınızı çalıyor. Karşılığında eşya vereceğini söyleyerek 1 Su istiyor.',
          options: [
            { label: '1 Su Ver (Kapıyı Aç)', condition: newSupplies.water > 0, action: () => tradeWithStranger(true), type: 'action' },
            { label: 'Açma (Risk Alma)', condition: true, action: () => tradeWithStranger(false), type: 'danger' }
          ]
        };
      }
    } else if (eventChance > 0.90 && newSupplies.radio > 0) {
      currentLog.push('Radyodan diğer sığınaklardaki insanların seslerini duydunuz. Umut arttı.');
    }

    const shouldNeedFood = (nextDayNum % 5 === 0); 
    const shouldNeedWater = (nextDayNum % 3 === 0); 

    let newSurvivors = survivors.map(s => {
      if (!s.isAlive) return s;
      let ns = { ...s };

      if (ns.status === 'expedition') {
        ns.expeditionDays++;
        if (ns.expeditionDays >= 3) {
          const returnChance = Math.random();
          if (returnChance > 0.3) {
            ns.status = 'shelter';
            ns.expeditionDays = 0;
            const foundWater = Math.floor(Math.random() * 3);
            const foundSoup = Math.floor(Math.random() * 3);
            const foundAmmo = Math.random() < 0.5 ? 1 : 0; 
            newSupplies.water += foundWater;
            newSupplies.soup += foundSoup;
            newSupplies.ammo += foundAmmo;
            currentLog.push(`${ns.name} keşiften döndü! (+${foundWater} Su, +${foundSoup} Çorba ${foundAmmo > 0 ? ', +1 Mermi' : ''})`);
          } else {
            ns.isAlive = false;
            currentLog.push(`⚠️ ${ns.name} keşfe çıktı ve bir daha geri dönmedi...`);
          }
        }
        return ns; 
      }

      if (shouldNeedFood) ns.needsFood = true; 
      if (shouldNeedWater) ns.needsWater = true; 
      if (shouldNeedFood || shouldNeedWater) currentLog.push(`${ns.name} acıktı/susadı.`);

      if (ns.needsFood) ns.daysHungry++;
      if (ns.needsWater) ns.daysThirsty++;
      
      if (ns.isSick) {
        if (Math.random() < 0.20) {
          ns.isSick = false;
          ns.daysSick = 0;
          currentLog.push(`${ns.name} kendiliğinden iyileşti!`);
        } else {
          ns.daysSick++;
        }
      }

      if (!ns.isSick && Math.random() < 0.05) {
        ns.isSick = true;
        currentLog.push(`${ns.name} hastalandı!`);
      }

      if (ns.daysThirsty >= 3) { ns.isAlive = false; currentLog.push(`💀 ${ns.name} susuzluktan öldü!`); }
      else if (ns.daysHungry >= 5) { ns.isAlive = false; currentLog.push(`💀 ${ns.name} açlıktan öldü!`); }
      else if (ns.daysSick >= 6) { ns.isAlive = false; currentLog.push(`💀 ${ns.name} hastalıktan öldü!`); }

      return ns;
    });

    let newLogs = [...logs];
    if (currentLog.length > 0) newLogs.unshift(`[Gün ${nextDayNum}] ${currentLog.join(' ')}`);

    syncState(newSupplies, newSurvivors, nextDayNum, newLogs, newEvent);

    if (newSurvivors.every(s => !s.isAlive)) {
      setTimeout(() => {
        setGameStateSafe('gameover');
        if (conn) conn.send({ type: 'gameover' });
      }, 500);
    }
  };

  // 5 Dakikalık Otomatik İlerleme
  const nextDayRef = useRef(null);
  useEffect(() => { nextDayRef.current = tryNextDay; });
  useEffect(() => {
    if (gameState === 'survival' && !eventModal) {
      const timer = setInterval(() => {
        if(nextDayRef.current) nextDayRef.current();
      }, 300000); 
      return () => clearInterval(timer);
    }
  }, [gameState, eventModal]);


  // Manuel Olay Tetikleyicileri (Ortak)
  const executeActionLocally = (action, id) => {
    if (action === 'feed' && supplies.soup > 0) {
      const newSup = { ...supplies, soup: supplies.soup - 1 };
      const newSurv = survivors.map(s => s.id === id ? { ...s, needsFood: false, daysHungry: 0 } : s);
      const newLogs = [`[Gün ${day}] ${survivors.find(s=>s.id===id).name} çorba içti.`, ...logs];
      if(isHost || !isMultiplayer) syncState(newSup, newSurv, day, newLogs, eventModal);
    }
    else if (action === 'water' && supplies.water > 0) {
      const newSup = { ...supplies, water: supplies.water - 1 };
      const newSurv = survivors.map(s => s.id === id ? { ...s, needsWater: false, daysThirsty: 0 } : s);
      const newLogs = [`[Gün ${day}] ${survivors.find(s=>s.id===id).name} su içti.`, ...logs];
      if(isHost || !isMultiplayer) syncState(newSup, newSurv, day, newLogs, eventModal);
    }
    else if (action === 'heal' && supplies.medkit > 0) {
      const newSup = { ...supplies, medkit: supplies.medkit - 1 };
      const newSurv = survivors.map(s => s.id === id ? { ...s, isSick: false, daysSick: 0 } : s);
      const newLogs = [`[Gün ${day}] ${survivors.find(s=>s.id===id).name} tedavi edildi.`, ...logs];
      if(isHost || !isMultiplayer) syncState(newSup, newSurv, day, newLogs, eventModal);
    }
    else if (action === 'expedition') {
      const newSurv = survivors.map(s => s.id === id ? { ...s, status: 'expedition', expeditionDays: 0 } : s);
      const newLogs = [`[Gün ${day}] ${survivors.find(s=>s.id===id).name} dışarı keşfe gönderildi.`, ...logs];
      if(isHost || !isMultiplayer) syncState(supplies, newSurv, day, newLogs, eventModal);
    }
  };

  const handleAction = (action, id) => {
    if (isMultiplayer && conn) conn.send({ type: 'action', action, id });
    executeActionLocally(action, id);
  };


  /* =========================================================
     RENDER
     ========================================================= */
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const usedCapacity = inventory.reduce((total, item) => total + item.size, 0);

  return (
    <div className="game-wrapper">
      
      {gameState === 'start' && (
        <div className="overlay-screen">
          <h1 className="title">☢️ 60 SANİYE ☢️</h1>
          <p className="desc">
            Nükleer sirenler çalıyor! Sığınağa girmeden önce eşyaları topla.
          </p>
          
          {!peerId && !isMultiplayer && (
            <div className="menu-buttons" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button className="btn" onClick={startSinglePlayer}>TEK OYUNCULU</button>
              <button className="btn action" onClick={hostRoom}>ODA KUR (CO-OP)</button>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <input 
                  type="text" 
                  placeholder="Oda Kodu Girin" 
                  value={joinId} 
                  onChange={e => setJoinId(e.target.value)}
                  style={{ padding: '0.8rem', fontSize: '1.2rem', borderRadius: '8px', border: 'none' }}
                />
                <button className="btn warning" onClick={joinRoom} disabled={!joinId}>ODAYA KATIL</button>
              </div>
            </div>
          )}

          {isMultiplayer && isHost && peerId && (
            <div style={{ background: '#222', padding: '2rem', borderRadius: '12px' }}>
              <h3>Oda Kuruldu!</h3>
              <p>Arkadaşınızın odaya katılabilmesi için şu kodu gönderin:</p>
              <h2 style={{ color: '#3b82f6', userSelect: 'all' }}>{peerId}</h2>
              <p style={{ fontSize: '1rem', opacity: 0.7 }}>Arkadaşınız kodu girip bağlandığında oyun otomatik başlayacaktır.</p>
            </div>
          )}

          {isMultiplayer && !isHost && !conn && (
            <p>Bağlanılıyor...</p>
          )}

        </div>
      )}

      {gameState === 'playing' && (
        <>
          <div className="ui-panel">
            <div className={`timer ${timeLeft <= 10 ? 'urgent' : ''}`}>{formatTime(timeLeft)}</div>
            <div className="inventory-info">
              <div className="capacity-text">
                Envanter: {usedCapacity} / {MAX_CAPACITY} 
                <span style={{ fontSize: '1rem', marginLeft: '10px' }}>
                  ({inventory.map(i => i.icon).join('')})
                </span>
              </div>
              <div className="capacity-bar">
                <div className={`capacity-fill ${usedCapacity === MAX_CAPACITY ? 'full' : ''}`} style={{ width: `${(usedCapacity / MAX_CAPACITY) * 100}%` }}></div>
              </div>
            </div>
          </div>

          <div className="arena-container">
            <div className="arena">
              <div className={`shelter ${Math.hypot(playerPos.x - SHELTER_POS.x, playerPos.y - SHELTER_POS.y) < SHELTER_POS.radius ? 'active' : ''}`} style={{ left: SHELTER_POS.x, top: SHELTER_POS.y }}>
                <div className="shelter-inner">☢️</div>
              </div>

              {itemsOnMap.map(item => {
                const isNear = Math.hypot(playerPos.x - item.x, playerPos.y - item.y) < INTERACTION_DISTANCE;
                return (
                  <div key={item.uid} className="item" style={{ left: item.x, top: item.y }}>
                    {item.icon}
                    {isNear && <div className="interaction-hint">E ({item.size})</div>}
                  </div>
                );
              })}

              <div className="player" style={{ left: playerPos.x, top: playerPos.y }}>🏃
                {capacityWarning && <div className="capacity-warning">Dolu!</div>}
              </div>

              {/* ARKADAŞIN KARAKTERİ */}
              {isMultiplayer && (
                 <div className="player remote" style={{ left: remotePlayerPos.x, top: remotePlayerPos.y, background: '#ef4444', borderColor: '#f87171' }}>🏃</div>
              )}
            </div>
          </div>

          <div className="mobile-controls">
            <div className="d-pad">
              <button className="btn-dir up" onPointerDown={() => handleControlStart('w')} onPointerUp={() => handleControlEnd('w')} onTouchStart={() => handleControlStart('w')} onTouchEnd={() => handleControlEnd('w')}>▲</button>
              <div className="d-pad-middle">
                <button className="btn-dir left" onPointerDown={() => handleControlStart('a')} onPointerUp={() => handleControlEnd('a')} onTouchStart={() => handleControlStart('a')} onTouchEnd={() => handleControlEnd('a')}>◀</button>
                <div className="d-pad-center"></div>
                <button className="btn-dir right" onPointerDown={() => handleControlStart('d')} onPointerUp={() => handleControlEnd('d')} onTouchStart={() => handleControlStart('d')} onTouchEnd={() => handleControlEnd('d')}>▶</button>
              </div>
              <button className="btn-dir down" onPointerDown={() => handleControlStart('s')} onPointerUp={() => handleControlEnd('s')} onTouchStart={() => handleControlStart('s')} onTouchEnd={() => handleControlEnd('s')}>▼</button>
            </div>
            
            <div className="action-pad">
              <button className="btn-action e-btn" onPointerDown={() => handleControlStart('e')} onPointerUp={() => handleControlEnd('e')} onTouchStart={() => handleControlStart('e')} onTouchEnd={() => handleControlEnd('e')}>E</button>
            </div>
          </div>
        </>
      )}

      {gameState === 'survival' && (
        <div className="survival-screen">
          
          {eventModal && (
            <div className="event-modal">
              <div className="event-box">
                <h2>{eventModal.title}</h2>
                <p>{eventModal.msg}</p>
                <div className="event-options">
                  {eventModal.options.map((opt, i) => (
                    <button 
                      key={i} 
                      className={`btn event-btn ${opt.type || ''}`} 
                      onClick={() => handleEventChoice(i)}
                      disabled={!opt.condition}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="survival-header">
            <h1>{day}. GÜN</h1>
            <button 
              className={`btn next-day-btn ${localReady ? 'ready' : ''}`} 
              onClick={tryNextDay} 
              disabled={eventModal !== null || localReady}
            >
              {localReady ? (isMultiplayer ? 'Arkadaşınız Bekleniyor...' : 'Bekleniyor...') : 'SONRAKİ GÜN ⏭️'}
            </button>
          </div>

          <div className="survival-content">
            <div className="supplies-panel">
              <h2>Erzaklar</h2>
              <div className="supplies-grid">
                <div className="supply-item">🥫 Çorba: <strong>{supplies.soup}</strong></div>
                <div className="supply-item">💧 Su: <strong>{supplies.water}</strong></div>
                <div className="supply-item">🩹 İlkyardım: <strong>{supplies.medkit}</strong></div>
                <div className="supply-item">📻 Radyo: <strong>{supplies.radio}</strong></div>
                <div className="supply-item">🪓 Balta: <strong>{supplies.axe}</strong></div>
                <div className="supply-item">🤿 Maske: <strong>{supplies.mask}</strong></div>
                <div className="supply-item highlight">🔫 Silah: <strong>{supplies.gun}</strong></div>
                <div className="supply-item highlight">🔘 Mermi: <strong>{supplies.ammo}</strong></div>
              </div>
            </div>

            <div className="survivors-panel">
              <h2>Sığınaktakiler</h2>
              <div className="survivors-list">
                {survivors.map(s => (
                  <div key={s.id} className={`survivor-card ${!s.isAlive ? 'dead' : ''} ${s.status === 'expedition' ? 'away' : ''}`}>
                    <div className="survivor-icon">{s.isAlive ? s.icon : '💀'}</div>
                    <div className="survivor-info">
                      <div className="survivor-name">{s.name} {s.status === 'expedition' && '(Keşifte)'}</div>
                      {s.isAlive && s.status !== 'expedition' && (
                        <div className="survivor-status">
                          {s.needsFood && <span className="stat warn">Aç ({s.daysHungry}/5)</span>}
                          {s.needsWater && <span className="stat danger">Susuz ({s.daysThirsty}/3)</span>}
                          {s.isSick && <span className="stat sick">Hasta ({s.daysSick}/6)</span>}
                          {!s.needsFood && !s.needsWater && !s.isSick && <span className="stat ok">Sağlıklı</span>}
                        </div>
                      )}
                    </div>
                    
                    {s.isAlive && s.status !== 'expedition' && (
                      <div className="survivor-actions">
                        <button onClick={() => handleAction('feed', s.id)} disabled={supplies.soup <= 0 || !s.needsFood || eventModal !== null} title="Yedir">🥫</button>
                        <button onClick={() => handleAction('water', s.id)} disabled={supplies.water <= 0 || !s.needsWater || eventModal !== null} title="İçir">💧</button>
                        <button onClick={() => handleAction('heal', s.id)} disabled={supplies.medkit <= 0 || !s.isSick || eventModal !== null} title="İyileştir">🩹</button>
                        <button onClick={() => handleAction('expedition', s.id)} disabled={eventModal !== null} title="Keşfe Gönder">🗺️</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="log-panel">
              <h2>Günlük</h2>
              <div className="log-list">
                {logs.map((log, i) => (
                  <div key={i} className="log-item">{log}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {gameState === 'gameover' && (
        <div className="overlay-screen">
          <div className="nuclear-flash"></div>
          <h1 className="title lost">SON!</h1>
          <p className="desc">
            {day > 1 
              ? `Sığınakta ${day} gün hayatta kaldınız, ama maalesef herkes hayatını kaybetti...`
              : 'Süre dolduğunda sığınakta değildin! Nükleer dalga seni yuttu.'}
          </p>
          <button className="btn" onClick={() => window.location.reload()}>BAŞTAN BAŞLA</button>
        </div>
      )}

    </div>
  );
}

export default App;
