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

  // Keşif Setup Modal Stateleri
  const [expeditionTarget, setExpeditionTarget] = useState(null);
  const [expeditionItems, setExpeditionItems] = useState({ water: 0, soup: 0, medkit: 0, axe: 0, mask: 0, gun: 0 });

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
    peer.on('error', (err) => {
      console.error('PeerJS Host Hatası:', err);
      alert('Bağlantı hatası: ' + err.type);
      setIsMultiplayer(false);
      setPeerId('');
    });

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
    peer.on('error', (err) => {
      console.error('PeerJS Join Hatası:', err);
      alert('Bağlantı kurulamadı: ' + err.type);
      setIsMultiplayer(false);
    });

  };

  const setupConnListeners = (connection) => {
    connection.on('close', () => {
      alert('Bağlantı kesildi! Başlangıç ekranına dönülüyor.');
      setConn(null);
      setIsMultiplayer(false);
      setGameStateSafe('start');
    });

    connection.on('error', (err) => {
      console.error('Bağlantı hatası:', err);
      alert('Bağlantı koptu!');
      setConn(null);
      setIsMultiplayer(false);
      setGameStateSafe('start');
    });

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
        itemsOnMapRef.current = (itemsOnMapRef.current || []).filter(i => i.uid !== data.uid);
        setItemsOnMap([...itemsOnMapRef.current]);
      } 
      else if (data.type === 'shelter_enter') {
        shelterItemsRef.current = [...(shelterItemsRef.current || []), ...data.inv];
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
        if (data.action === 'expedition') executeActionLocally('expedition', data.id, data.extra);
        if (data.action === 'eventChoice') executeEventChoiceLocally(data.choiceIdx);
      }
      else if (data.type === 'timer_sync') {
        setTimeLeft(data.time);
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
          const nextVal = prev <= 1 ? 0 : prev - 1;
          if (nextVal === 0) {
            clearInterval(timerId);
          }
          if (isMultiplayer && isHost && conn) {
            conn.send({ type: 'timer_sync', time: nextVal });
          }
          return nextVal;
        });
      }, 1000);
    }
    return () => {
      clearInterval(timerId);
    };
  }, [gameState, isMultiplayer, isHost, conn]);

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
  // Güncel state'e her zaman ulaşabilmek için ref kullanıyoruz
  const suppliesRef = useRef(supplies);
  const survivorsRef = useRef(survivors);
  const dayRef = useRef(day);
  const logsRef = useRef(logs);
  useEffect(() => { suppliesRef.current = supplies; }, [supplies]);
  useEffect(() => { survivorsRef.current = survivors; }, [survivors]);
  useEffect(() => { dayRef.current = day; }, [day]);
  useEffect(() => { logsRef.current = logs; }, [logs]);

  const syncState = (newSupplies, newSurvivors, newDay, newLogs, newEventModal) => {
    setSupplies(newSupplies);
    setSurvivors(newSurvivors);
    setDay(newDay);
    setLogs(newLogs);
    // Event modal'da fonksiyon referansı olmadığı için direkt set ediyoruz
    // Eğer newEventModal varsa action'ı string ID olarak saklıyoruz
    setEventModal(newEventModal);
    setLocalReady(false);
    setRemoteReady(false);
    if (conn && isHost) {
      // Fonksiyonları serialize etmek için eventModal'dan action'ı çıkar
      const serializableModal = newEventModal ? {
        ...newEventModal,
        options: newEventModal.options.map(opt => ({ ...opt, action: undefined }))
      } : null;
      conn.send({ type: 'state_sync', supplies: newSupplies, survivors: newSurvivors, day: newDay, logs: newLogs, eventModal: serializableModal });
    }
  };

  // Event seçeneklerini string ID ile temsil ederek stale closure sorununu önlüyoruz
  // Kullanıcı seçim yapınca bu dispatcher en güncel state'i kullanır
  const dispatchEventAction = (actionId, extraArg) => {
    const sup = suppliesRef.current;
    const surv = survivorsRef.current;
    const d = dayRef.current;
    const lg = logsRef.current;

    if (actionId === 'fireGun') {
      const newSup = { ...sup, ammo: sup.ammo - 1 };
      const newLogs = [`[Gün ${d}] Silahı ateşleyip haydutları korkutarak kaçırdınız! (-1 Mermi)`, ...lg];
      syncState(newSup, surv, d, newLogs, null);
    } else if (actionId === 'hideFromBandits') {
      let newSup = { ...sup };
      let newLogs = [...lg];
      if (Math.random() < 0.5) {
        newLogs.unshift(`[Gün ${d}] Haydutlar kapıyı kırdı ve erzak çaldılar! (-1 Çorba, -1 Su)`);
        newSup.soup = Math.max(0, newSup.soup - 1);
        newSup.water = Math.max(0, newSup.water - 1);
      } else {
        newLogs.unshift(`[Gün ${d}] Ses çıkarmadınız. Haydutlar kapıyı zorlayıp vazgeçtiler.`);
      }
      syncState(newSup, surv, d, newLogs, null);
    } else if (actionId === 'tradeAccept') {
      let newSup = { ...sup, water: sup.water - 1, ammo: sup.ammo + 2 };
      const newLogs = [`[Gün ${d}] Yaşlı adama su verdiniz. O da masaya 2 Mermi bıraktı.`, ...lg];
      syncState(newSup, surv, d, newLogs, null);
    } else if (actionId === 'tradeReject') {
      const newLogs = [`[Gün ${d}] Yabancıya kapıyı açmadınız. Homurdanarak uzaklaştı.`, ...lg];
      syncState(sup, surv, d, newLogs, null);
    } else if (actionId === 'simpleAck') {
      const newLogs = [`[Gün ${d}] ${extraArg}`, ...lg];
      syncState(sup, surv, d, newLogs, null);
    }
  };

  const executeEventChoiceLocally = (idx) => {
    if (eventModal && eventModal.options[idx]) {
      const opt = eventModal.options[idx];
      dispatchEventAction(opt.actionId, opt.actionArg);
    }
  };

  const handleEventChoice = (idx) => {
    if (isMultiplayer && conn) conn.send({ type: 'action', action: 'eventChoice', choiceIdx: idx });
    executeEventChoiceLocally(idx);
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
      if (eventType < 0.15) { // Şans %30'dan %15'e düşürüldü
        const giftWater = Math.random() < 0.5 ? 1 : 0;
        const giftSoup = giftWater === 0 ? 1 : (Math.random() < 0.3 ? 1 : 0); // Genelde sadece 1 eşya, nadiren ikisi birden
        newSupplies.water += giftWater;
        newSupplies.soup += giftSoup;
        
        let giftText = '';
        if (giftWater > 0 && giftSoup > 0) giftText = '(+1 Su, +1 Çorba)';
        else if (giftWater > 0) giftText = '(+1 Su)';
        else giftText = '(+1 Çorba)';

        newEvent = {
          title: 'Sürpriz Paket!',
          msg: `Kapıya gizemli biri paket bırakmış! ${giftText}`,
          options: [{ label: 'Tamam', condition: true, actionId: 'simpleAck', actionArg: `Dışarıdan erzak yardımı geldi: ${giftText}` }]
        };
      } else if (eventType < 0.65) {
        newEvent = {
          title: 'Haydutlar Geldi!',
          msg: 'Yüzü maskeli adamlar kapıya vuruyor! İçeri girmeye çalışıyorlar.',
          options: [
            { label: 'Silahla Vur (-1 Mermi)', condition: newSupplies.gun > 0 && newSupplies.ammo > 0, actionId: 'fireGun', type: 'action' },
            { label: 'Sessiz Ol (Saklan)', condition: true, actionId: 'hideFromBandits', type: 'danger' }
          ]
        };
      } else {
        newEvent = {
          title: 'Yaşlı Bir Adam',
          msg: 'Bitkin düşmüş yaşlı bir adam kapınızı çalıyor. Karşılığında eşya vereceğini söyleyerek 1 Su istiyor.',
          options: [
            { label: '1 Su Ver (Kapıyı Aç)', condition: newSupplies.water > 0, actionId: 'tradeAccept', type: 'action' },
            { label: 'Açma (Risk Alma)', condition: true, actionId: 'tradeReject', type: 'danger' }
          ]
        };
      }
    } else if (eventChance > 0.90 && newSupplies.radio > 0) {
      currentLog.push('Radyodan diğer sığınaklardaki insanların seslerini duydunuz. Umut arttı.');
    }

    const shouldNeedFood = (nextDayNum % 5 === 0); 
    const shouldNeedWater = (nextDayNum % 3 === 0); 

    let newSurvivors = (survivors || []).map(s => {
      if (!s.isAlive) return s;
      let ns = { ...s };

      if (ns.status === 'expedition') {
        ns.expeditionDays++;
        if (ns.expeditionDays >= 3) {
          const carried = ns.carriedItems || { water: 0, soup: 0, medkit: 0, axe: 0, mask: 0, gun: 0 };
          
          // Eşyaların hayatta kalma oranına etkisi (Maske varsa %95, Silah varsa %90, normalde %70)
          let baseDeathChance = 0.30;
          if (carried.mask > 0) {
            baseDeathChance = 0.05;
          } else if (carried.gun > 0) {
            baseDeathChance = 0.10;
          }

          const returnChance = Math.random();
          const survived = returnChance > baseDeathChance;

          if (survived) {
            ns.status = 'shelter';
            ns.expeditionDays = 0;

            // Taban erzak bulma oranları azaltıldı (en fazla 1 erzak)
            let maxScavengeWater = 2; // Math.random() * 2 -> 0 veya 1
            let maxScavengeSoup = 2;  // Math.random() * 2 -> 0 veya 1
            let maxScavengeAmmo = 0.2;
            
            // Balta veya Silah varsa eski yüksek oranlar (+1-2 erzak) tetiklenir
            if (carried.axe > 0) {
              maxScavengeWater = 3; // 0-2 arası
              maxScavengeSoup = 3;  // 0-2 arası
              maxScavengeAmmo = 0.5;
            }
            if (carried.gun > 0) {
              maxScavengeWater = Math.max(maxScavengeWater, 3);
              maxScavengeSoup = Math.max(maxScavengeSoup, 3);
              maxScavengeAmmo = 0.8;
            }

            const foundWater = Math.floor(Math.random() * maxScavengeWater);
            const foundSoup = Math.floor(Math.random() * maxScavengeSoup);
            const foundAmmo = Math.random() < maxScavengeAmmo ? 1 : 0;

            newSupplies.water += foundWater;
            newSupplies.soup += foundSoup;
            newSupplies.ammo += foundAmmo;

            // Dayanıklı eşyaların iadesi (Maske, Balta, Silah)
            const returnedItems = [];
            if (carried.mask > 0) { newSupplies.mask += carried.mask; returnedItems.push('Gaz Maskesi'); }
            if (carried.axe > 0) { newSupplies.axe += carried.axe; returnedItems.push('Balta'); }
            if (carried.gun > 0) { newSupplies.gun += carried.gun; returnedItems.push('Silah'); }

            let logMsg = `${ns.name} keşiften döndü! (+${foundWater} Su, +${foundSoup} Çorba`;
            if (foundAmmo > 0) logMsg += `, +1 Mermi`;
            if (returnedItems.length > 0) logMsg += `, ${returnedItems.join(' ve ')} geri getirildi`;
            logMsg += ')';

            // Keşifte İlk Yardım Kiti kullanımı
            if (carried.medkit > 0 && ns.isSick) {
              ns.isSick = false;
              ns.daysSick = 0;
              logMsg += ` Keşif sırasında hastalanmıştı ama yanındaki İlk Yardımı kullanarak iyileşti.`;
            }

            // Keşif sırasında açlık/susuzluk önleme erzakları
            if (carried.water > 0) {
              ns.needsWater = false;
              ns.daysThirsty = 0;
            }
            if (carried.soup > 0) {
              ns.needsFood = false;
              ns.daysHungry = 0;
            }

            currentLog.push(logMsg);
          } else {
            ns.isAlive = false;
            // Kaybolan eşyaların log kaydı
            const lostList = Object.entries(carried)
              .filter(([_, qty]) => qty > 0)
              .map(([name, qty]) => `${qty}x ${getItemName(name)}`)
              .join(', ');
            
            const lostMsg = lostList 
              ? `⚠️ ${ns.name} keşfe çıktı ve geri dönmedi... Yanındaki [${lostList}] de kayboldu.`
              : `⚠️ ${ns.name} keşfe çıktı ve bir daha geri dönmedi...`;
            
            currentLog.push(lostMsg);
          }

          delete ns.carriedItems;
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


  // Keşif Helpers
  const getItemName = (id) => {
    switch (id) {
      case 'water': return 'Su';
      case 'soup': return 'Çorba';
      case 'medkit': return 'İlk Yardım';
      case 'radio': return 'Radyo';
      case 'axe': return 'Balta';
      case 'mask': return 'Gaz Maskesi';
      case 'gun': return 'Silah';
      case 'ammo': return 'Mermi';
      default: return id;
    }
  };

  const updateExpeditionItem = (key, delta) => {
    setExpeditionItems(prev => {
      const nextVal = Math.max(0, (prev[key] || 0) + delta);
      return { ...prev, [key]: nextVal };
    });
  };

  const getExpeditionTotal = () => {
    return Object.values(expeditionItems).reduce((sum, val) => sum + val, 0);
  };

  const startExpeditionConfirmed = () => {
    if (!expeditionTarget) return;
    handleAction('expedition', expeditionTarget.id, expeditionItems);
    setExpeditionTarget(null);
    setExpeditionItems({ water: 0, soup: 0, medkit: 0, axe: 0, mask: 0, gun: 0 });
  };

  // Manuel Olay Tetikleyicileri (Ortak)
  const executeActionLocally = (action, id, extra = null) => {
    const survivor = (survivors || []).find(s => s.id === id);
    const survivorName = survivor ? survivor.name : 'Biri';

    if (action === 'feed' && (supplies?.soup ?? 0) > 0) {
      const newSup = { ...supplies, soup: supplies.soup - 1 };
      const newSurv = (survivors || []).map(s => s.id === id ? { ...s, needsFood: false, daysHungry: 0 } : s);
      const newLogs = [`[Gün ${day}] ${survivorName} çorba içti.`, ...(logs || [])];
      if(isHost || !isMultiplayer) syncState(newSup, newSurv, day, newLogs, eventModal);
    }
    else if (action === 'water' && (supplies?.water ?? 0) > 0) {
      const newSup = { ...supplies, water: supplies.water - 1 };
      const newSurv = (survivors || []).map(s => s.id === id ? { ...s, needsWater: false, daysThirsty: 0 } : s);
      const newLogs = [`[Gün ${day}] ${survivorName} su içti.`, ...(logs || [])];
      if(isHost || !isMultiplayer) syncState(newSup, newSurv, day, newLogs, eventModal);
    }
    else if (action === 'heal' && (supplies?.medkit ?? 0) > 0) {
      const newSup = { ...supplies, medkit: supplies.medkit - 1 };
      const newSurv = (survivors || []).map(s => s.id === id ? { ...s, isSick: false, daysSick: 0 } : s);
      const newLogs = [`[Gün ${day}] ${survivorName} tedavi edildi.`, ...(logs || [])];
      if(isHost || !isMultiplayer) syncState(newSup, newSurv, day, newLogs, eventModal);
    }
    else if (action === 'expedition') {
      const items = extra || { water: 0, soup: 0, medkit: 0, axe: 0, mask: 0, gun: 0 };
      
      const newSup = { ...supplies };
      Object.keys(items).forEach(k => {
        newSup[k] = Math.max(0, (newSup[k] || 0) - (items[k] || 0));
      });

      const newSurv = (survivors || []).map(s => s.id === id ? { ...s, status: 'expedition', expeditionDays: 0, carriedItems: items } : s);
      
      const takenList = Object.entries(items)
        .filter(([_, qty]) => qty > 0)
        .map(([name, qty]) => `${qty}x ${getItemName(name)}`)
        .join(', ');
      
      const logMsg = takenList 
        ? `[Gün ${day}] ${survivorName} yanına [${takenList}] alarak keşfe çıktı.`
        : `[Gün ${day}] ${survivorName} hiçbir eşya almadan keşfe çıktı.`;

      const newLogs = [logMsg, ...(logs || [])];
      if(isHost || !isMultiplayer) syncState(newSup, newSurv, day, newLogs, eventModal);
    }
  };

  const handleAction = (action, id, extra = null) => {
    if (isMultiplayer && conn) conn.send({ type: 'action', action, id, extra });
    executeActionLocally(action, id, extra);
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
                  {(eventModal.options || []).map((opt, i) => (
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

          {/* YENİ: Keşif Eşya Seçim Modalı */}
          {expeditionTarget && (
            <div className="event-modal">
              <div className="event-box" style={{ maxWidth: '500px' }}>
                <h2>🗺️ Keşif Hazırlığı</h2>
                <p><strong>{expeditionTarget.name}</strong> dışarı keşfe çıkacak. Yanına vermek istediğiniz erzak ve ekipmanları seçin (En fazla 3 adet):</p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', margin: '1.5rem 0', textAlign: 'left', background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px' }}>
                  
                  {/* SU */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>💧 Su (Mevcut: {supplies?.water ?? 0}):</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button className="btn" style={{ padding: '0.2rem 0.6rem', fontSize: '1rem' }} onClick={() => updateExpeditionItem('water', -1)} disabled={expeditionItems.water <= 0}>-</button>
                      <strong style={{ fontSize: '1.2rem', width: '20px', textAlign: 'center' }}>{expeditionItems.water}</strong>
                      <button className="btn" style={{ padding: '0.2rem 0.6rem', fontSize: '1rem' }} onClick={() => updateExpeditionItem('water', 1)} disabled={expeditionItems.water >= (supplies?.water ?? 0) || getExpeditionTotal() >= 3}>+</button>
                    </div>
                  </div>

                  {/* ÇORBA */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>🥫 Çorba (Mevcut: {supplies?.soup ?? 0}):</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button className="btn" style={{ padding: '0.2rem 0.6rem', fontSize: '1rem' }} onClick={() => updateExpeditionItem('soup', -1)} disabled={expeditionItems.soup <= 0}>-</button>
                      <strong style={{ fontSize: '1.2rem', width: '20px', textAlign: 'center' }}>{expeditionItems.soup}</strong>
                      <button className="btn" style={{ padding: '0.2rem 0.6rem', fontSize: '1rem' }} onClick={() => updateExpeditionItem('soup', 1)} disabled={expeditionItems.soup >= (supplies?.soup ?? 0) || getExpeditionTotal() >= 3}>+</button>
                    </div>
                  </div>

                  {/* GAZ MASKESİ */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>🤿 Gaz Maskesi (Mevcut: {supplies?.mask ?? 0}):</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button className="btn" style={{ padding: '0.2rem 0.6rem', fontSize: '1rem' }} onClick={() => updateExpeditionItem('mask', -1)} disabled={expeditionItems.mask <= 0}>-</button>
                      <strong style={{ fontSize: '1.2rem', width: '20px', textAlign: 'center' }}>{expeditionItems.mask}</strong>
                      <button className="btn" style={{ padding: '0.2rem 0.6rem', fontSize: '1rem' }} onClick={() => updateExpeditionItem('mask', 1)} disabled={expeditionItems.mask >= (supplies?.mask ?? 0) || getExpeditionTotal() >= 3}>+</button>
                    </div>
                  </div>

                  {/* BALTA */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>🪓 Balta (Mevcut: {supplies?.axe ?? 0}):</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button className="btn" style={{ padding: '0.2rem 0.6rem', fontSize: '1rem' }} onClick={() => updateExpeditionItem('axe', -1)} disabled={expeditionItems.axe <= 0}>-</button>
                      <strong style={{ fontSize: '1.2rem', width: '20px', textAlign: 'center' }}>{expeditionItems.axe}</strong>
                      <button className="btn" style={{ padding: '0.2rem 0.6rem', fontSize: '1rem' }} onClick={() => updateExpeditionItem('axe', 1)} disabled={expeditionItems.axe >= (supplies?.axe ?? 0) || getExpeditionTotal() >= 3}>+</button>
                    </div>
                  </div>

                  {/* SİLAH */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>🔫 Silah (Mevcut: {supplies?.gun ?? 0}):</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button className="btn" style={{ padding: '0.2rem 0.6rem', fontSize: '1rem' }} onClick={() => updateExpeditionItem('gun', -1)} disabled={expeditionItems.gun <= 0}>-</button>
                      <strong style={{ fontSize: '1.2rem', width: '20px', textAlign: 'center' }}>{expeditionItems.gun}</strong>
                      <button className="btn" style={{ padding: '0.2rem 0.6rem', fontSize: '1rem' }} onClick={() => updateExpeditionItem('gun', 1)} disabled={expeditionItems.gun >= (supplies?.gun ?? 0) || getExpeditionTotal() >= 3}>+</button>
                    </div>
                  </div>

                  {/* İLK YARDIM */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>🩹 İlk Yardım (Mevcut: {supplies?.medkit ?? 0}):</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button className="btn" style={{ padding: '0.2rem 0.6rem', fontSize: '1rem' }} onClick={() => updateExpeditionItem('medkit', -1)} disabled={expeditionItems.medkit <= 0}>-</button>
                      <strong style={{ fontSize: '1.2rem', width: '20px', textAlign: 'center' }}>{expeditionItems.medkit}</strong>
                      <button className="btn" style={{ padding: '0.2rem 0.6rem', fontSize: '1rem' }} onClick={() => updateExpeditionItem('medkit', 1)} disabled={expeditionItems.medkit >= (supplies?.medkit ?? 0) || getExpeditionTotal() >= 3}>+</button>
                    </div>
                  </div>

                </div>

                <div style={{ fontSize: '0.9rem', opacity: 0.8, marginBottom: '1.5rem', textAlign: 'left', lineHeight: '1.4' }}>
                  ℹ️ <strong>Eşya Etkileri:</strong><br/>
                  • 🤿 Maske: Sağ dönme şansını <strong>%95'e</strong> çıkarır.<br/>
                  • 🪓 Balta veya 🔫 Silah: Keşiften <strong>daha fazla erzak</strong> getirme şansı sağlar.<br/>
                  • 🩹 İlk Yardım: Keşifte yaralanma/hastalık olursa <strong>otomatik tedavi</strong> eder.<br/>
                  • 💧/🥫 Su/Çorba: Keşif boyunca susuzluk/açlığı önler.<br/>
                  • ⚠️ Maksimum 3 adet eşya seçebilirsiniz.
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button className="btn warning" style={{ flex: 1 }} onClick={() => { setExpeditionTarget(null); setExpeditionItems({ water: 0, soup: 0, medkit: 0, axe: 0, mask: 0, gun: 0 }); }}>Vazgeç</button>
                  <button className="btn action" style={{ flex: 1 }} onClick={startExpeditionConfirmed}>Keşfi Başlat 🗺️</button>
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
                <div className="supply-item">🥫 Çorba: <strong>{supplies?.soup ?? 0}</strong></div>
                <div className="supply-item">💧 Su: <strong>{supplies?.water ?? 0}</strong></div>
                <div className="supply-item">🩹 İlkyardım: <strong>{supplies?.medkit ?? 0}</strong></div>
                <div className="supply-item">📻 Radyo: <strong>{supplies?.radio ?? 0}</strong></div>
                <div className="supply-item">🪓 Balta: <strong>{supplies?.axe ?? 0}</strong></div>
                <div className="supply-item">🤿 Maske: <strong>{supplies?.mask ?? 0}</strong></div>
                <div className="supply-item highlight">🔫 Silah: <strong>{supplies?.gun ?? 0}</strong></div>
                <div className="supply-item highlight">🔘 Mermi: <strong>{supplies?.ammo ?? 0}</strong></div>
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
                        <button onClick={() => handleAction('feed', s.id)} disabled={(supplies?.soup ?? 0) <= 0 || !s.needsFood || eventModal !== null} title="Yedir">🥫</button>
                        <button onClick={() => handleAction('water', s.id)} disabled={(supplies?.water ?? 0) <= 0 || !s.needsWater || eventModal !== null} title="İçir">💧</button>
                        <button onClick={() => handleAction('heal', s.id)} disabled={(supplies?.medkit ?? 0) <= 0 || !s.isSick || eventModal !== null} title="İyileştir">🩹</button>
                        <button onClick={() => { setExpeditionTarget(s); setExpeditionItems({ water: 0, soup: 0, medkit: 0, axe: 0, mask: 0, gun: 0 }); }} disabled={eventModal !== null || expeditionTarget !== null} title="Keşfe Gönder">🗺️</button>
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


      {/* FALLBACK: Eğer hiçbir state eşleşmezse siyah ekran kalmasın */}
      {!['start', 'playing', 'survival', 'gameover'].includes(gameState) && (
        <div className="overlay-screen">
          <p>Yükleniyor...</p>
          <button className="btn" onClick={() => window.location.reload()}>Yenile</button>
        </div>
      )}

    </div>

  );
}

export default App;
