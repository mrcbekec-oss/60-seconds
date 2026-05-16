import React, { useState, useEffect } from 'react';
import './index.css';

const MAX_CAPACITY = 5;
const START_TIME = 60;

const INITIAL_ITEMS = [
  { id: 'child', name: 'Çocuk', size: 3, icon: '🧒', initialCount: 1 },
  { id: 'spouse', name: 'Eş', size: 3, icon: '🧑', initialCount: 1 },
  { id: 'water', name: 'Su Şişesi', size: 1, icon: '💧', initialCount: 4 },
  { id: 'soup', name: 'Çorba', size: 1, icon: '🥫', initialCount: 4 },
  { id: 'radio', name: 'Radyo', size: 1, icon: '📻', initialCount: 1 },
  { id: 'medkit', name: 'İlk Yardım', size: 2, icon: '🩹', initialCount: 1 },
  { id: 'axe', name: 'Balta', size: 2, icon: '🪓', initialCount: 1 },
  { id: 'mask', name: 'Gaz Maskesi', size: 1, icon: '🤿', initialCount: 2 },
  { id: 'book', name: 'Kitap', size: 1, icon: '📖', initialCount: 1 },
];

function App() {
  const [gameState, setGameState] = useState('start'); // 'start', 'playing', 'won', 'lost'
  const [timeLeft, setTimeLeft] = useState(START_TIME);
  const [inventory, setInventory] = useState([]);
  const [items, setItems] = useState([]);

  // Toplam kullanılan alanı hesaplama
  const usedCapacity = inventory.reduce((total, item) => total + item.size, 0);

  // Oyunu başlatma
  const startGame = () => {
    setGameState('playing');
    setTimeLeft(START_TIME);
    setInventory([]);
    setItems(INITIAL_ITEMS.map(item => ({ ...item, count: item.initialCount })));
  };

  // Saniye sayacı
  useEffect(() => {
    let timer;
    if (gameState === 'playing' && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (gameState === 'playing' && timeLeft === 0) {
      setGameState('lost'); // Süre bitti, sığınağa girilmedi
    }
    return () => clearInterval(timer);
  }, [gameState, timeLeft]);

  // Eşya ekleme
  const addToInventory = (item) => {
    if (usedCapacity + item.size <= MAX_CAPACITY && item.count > 0) {
      // Envantere ekle
      const newItem = { ...item, uniqueId: Date.now() + Math.random() };
      setInventory([...inventory, newItem]);
      
      // Mevcut eşya sayısını azalt
      setItems(items.map(i => 
        i.id === item.id ? { ...i, count: i.count - 1 } : i
      ));
    }
  };

  // Eşya çıkarma
  const removeFromInventory = (uniqueId, originalId) => {
    // Envanterden çıkar
    setInventory(inventory.filter(item => item.uniqueId !== uniqueId));
    
    // Mevcut eşya sayısını artır
    setItems(items.map(i => 
      i.id === originalId ? { ...i, count: i.count + 1 } : i
    ));
  };

  // Sığınağa gir
  const enterShelter = () => {
    if (gameState === 'playing') {
      setGameState('won');
    }
  };

  // Format the time as MM:SS
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="game-container">
      {/* BAŞLANGIÇ EKRANI */}
      {gameState === 'start' && (
        <div className="start-screen">
          <h1 className="start-title">☢️ 60 SANİYE ☢️</h1>
          <p className="start-desc">
            Nükleer sirenler çalıyor! Sığınağa girmeden önce sadece 60 saniyen var.
            Aileni ve hayatta kalmak için gerekli eşyaları yanına al. Unutma, sığınakta sadece <strong>{MAX_CAPACITY} birimlik</strong> yerin var.
          </p>
          <button className="start-btn" onClick={startGame}>OYUNA BAŞLA</button>
        </div>
      )}

      {/* OYUN İÇİ ARAYÜZ */}
      {(gameState === 'playing' || gameState === 'won' || gameState === 'lost') && (
        <>
          <div className="header">
            <div className={`timer ${timeLeft <= 10 && gameState === 'playing' ? 'urgent' : ''}`}>
              {formatTime(timeLeft)}
            </div>
            <div className="inventory-status">
              <div className="capacity-text">
                Kapasite: {usedCapacity} / {MAX_CAPACITY}
              </div>
              <div className="capacity-bar">
                <div 
                  className={`capacity-fill ${usedCapacity === MAX_CAPACITY ? 'full' : ''}`} 
                  style={{ width: `${(usedCapacity / MAX_CAPACITY) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="main-area">
            {/* ETRAFTAKİ EŞYALAR */}
            <div className="items-panel">
              <h2>Evdeki Eşyalar</h2>
              <div className="items-grid">
                {items.map(item => {
                  const canAdd = usedCapacity + item.size <= MAX_CAPACITY;
                  const isDisabled = item.count === 0 || !canAdd;
                  
                  return (
                    <div 
                      key={item.id} 
                      className={`item-card ${isDisabled ? 'disabled' : ''}`}
                      onClick={() => !isDisabled && addToInventory(item)}
                    >
                      <div className="item-icon">{item.icon}</div>
                      <div className="item-name">{item.name}</div>
                      <div className="item-badges">
                        <span className="badge size">Boyut: {item.size}</span>
                        <span className="badge count">Adet: {item.count}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SIĞINAK ENVANTERİ */}
            <div className="inventory-panel">
              <h2>Sığınağa Alınanlar</h2>
              <div className="inventory-list">
                {inventory.length === 0 ? (
                  <div style={{ textAlign: 'center', opacity: 0.5, marginTop: '2rem' }}>
                    Sığınak henüz boş...
                  </div>
                ) : (
                  inventory.map(item => (
                    <div key={item.uniqueId} className="inventory-item">
                      <div className="inventory-item-info">
                        <span style={{ fontSize: '1.5rem' }}>{item.icon}</span>
                        <span>{item.name} (B: {item.size})</span>
                      </div>
                      <button 
                        className="remove-btn"
                        onClick={() => removeFromInventory(item.uniqueId, item.id)}
                        disabled={gameState !== 'playing'}
                        title="Çıkar"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
              <button 
                className="shelter-btn" 
                onClick={enterShelter}
                disabled={gameState !== 'playing'}
              >
                🚪 SIĞINAĞA GİR
              </button>
            </div>
          </div>
        </>
      )}

      {/* OYUN BİTİŞ EKRANI (KAZANMA/KAYBETME) */}
      {(gameState === 'won' || gameState === 'lost') && (
        <div className="game-over-screen">
          {gameState === 'lost' && <div className="nuclear-overlay"></div>}
          <h1 className={`result-title ${gameState}`}>
            {gameState === 'won' ? 'BAŞARIYLA SIĞINDIN!' : 'NÜKLEER PATLAMA!'}
          </h1>
          <p className="result-desc">
            {gameState === 'won' 
              ? `Süre dolmadan sığınağa girmeyi başardın. Sığınağa ${inventory.length} parça eşya/insan indirdin.`
              : 'Süre doldu ve sığınağa giremeden patlama dalgasına yakalandın.'}
          </p>
          
          <div className="summary-panel">
            <h3>Sığınağa Getirilenler:</h3>
            <hr style={{ borderColor: 'rgba(255,255,255,0.1)', margin: '1rem 0' }}/>
            {inventory.length === 0 ? (
              <p>Hiçbir şey getiremedin...</p>
            ) : (
              <ul>
                {inventory.map(item => (
                  <li key={item.uniqueId} style={{ marginBottom: '0.5rem', listStyle: 'none' }}>
                    {item.icon} {item.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
          
          <button className="restart-btn" onClick={startGame}>
            TEKRAR DENE
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
