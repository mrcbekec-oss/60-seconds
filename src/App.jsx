import React, { useState, useEffect, useRef } from 'react';
import { Peer } from 'peerjs';
import './App.css';

const App = () => {
  const [role, setRole] = useState(null);
  const [roomId, setRoomId] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [clues, setClues] = useState([]);
  const [puzzleStep, setPuzzleStep] = useState(1);
  const [status, setStatus] = useState('Başlatılıyor...');
  const [connected, setConnected] = useState(false);
  
  const peerRef = useRef(null);
  const connRef = useRef(null);

  useEffect(() => {
    if (isJoined && role) {
      const peerId = role === 'past' ? `antigravity-p-${roomId}` : `antigravity-f-${roomId}`;
      const peer = new Peer(peerId, {
        config: { 'iceServers': [{ url: 'stun:stun.l.google.com:19302' }] }
      });
      peerRef.current = peer;

      peer.on('open', () => setStatus('Sistem Çevrimiçi. Bekleniyor...'));
      peer.on('connection', (conn) => setupConnection(conn));
      peer.on('error', () => {
        if (role === 'future') setTimeout(attemptConnection, 3000);
      });
      return () => peer.destroy();
    }
  }, [isJoined, role, roomId]);

  const attemptConnection = () => {
    if (!peerRef.current || connected) return;
    const conn = peerRef.current.connect(`antigravity-p-${roomId}`, { reliable: true });
    setupConnection(conn);
  };

  const setupConnection = (conn) => {
    connRef.current = conn;
    conn.on('open', () => {
      setConnected(true);
      setStatus('BAĞLANDI!');
    });

    conn.on('data', (data) => {
      if (data.type === 'next-step') {
        setPuzzleStep(data.step);
      } else {
        setClues((prev) => [...prev, data]);
      }
    });
  };

  const sendClue = (type, value) => {
    if (connRef.current && connRef.current.open) {
      connRef.current.send({ type, value });
    }
  };

  const nextStep = (step) => {
    setPuzzleStep(step);
    sendClue('next-step', step);
  };

  if (!isJoined) {
    return (
      <div className="choice-screen" style={{ flexDirection: 'column', background: '#0a0a0c' }}>
        <h1 className="glitch" data-text="ZAMAN ÖTESİ BAĞLANTI">ZAMAN ÖTESİ BAĞLANTI</h1>
        <div className="terminal-window">
          <p>Oda Numarası:</p>
          <input type="text" value={roomId} onChange={(e) => setRoomId(e.target.value)} style={{ background: 'transparent', border: '1px solid var(--future-accent)', color: 'white', padding: '1rem', width: '100%', textAlign: 'center' }} />
          <button onClick={() => setIsJoined(true)} style={{ marginTop: '1rem', width: '100%' }}>BAŞLA</button>
        </div>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="choice-screen">
        <div className="choice-side past" onClick={() => setRole('past')}><h1>GEÇMİŞ</h1></div>
        <div className="choice-side future" onClick={() => setRole('future')}><h1>GELECEK</h1></div>
      </div>
    );
  }

  return (
    <div className={`app-container ${role}-view`}>
      <button onClick={() => nextStep(puzzleStep + 1)} style={{ position: 'fixed', top: '10px', right: '10px', zIndex: 1000, padding: '5px 10px', fontSize: '10px', opacity: 0.5 }}>Aşamayı Atla (Hata Olursa)</button>

      {!connected && (
        <div className="success-overlay" style={{ background: 'rgba(0,0,0,0.8)' }}>
          <h2 className="glitch">{status}</h2>
          {role === 'future' && <button onClick={attemptConnection}>BAĞLANMAYI DENE</button>}
        </div>
      )}

      <div className="game-content" style={{ padding: '2rem' }}>
        {role === 'past' ? (
          <PastWorkflow step={puzzleStep} onNext={nextStep} sendClue={sendClue} incomingClues={clues} />
        ) : (
          <FutureWorkflow step={puzzleStep} onNext={nextStep} sendClue={sendClue} incomingClues={clues} />
        )}
      </div>
    </div>
  );
};

const PastWorkflow = ({ step, onNext, sendClue, incomingClues }) => {
  const [input, setInput] = useState('');
  
  const validateClock = () => {
    const clean = input.replace(/\D/g, '');
    if (clean === '0420') onNext(2);
    else alert('Saat tıkırdadı ama açılmadı. Doğru zaman mı? (04:20)');
  };

  const validateSafe = () => {
    if (input.replace(/\D/g, '') === '852') onNext(4);
  };

  return (
    <div className="game-view past">
      <h2>AŞAMA {step}</h2>
      
      {step === 1 && (
        <div className="paper-note">
          <h3>Antika Saat</h3>
          <p>Zamanı ayarla (04:20):</p>
          <input type="text" placeholder="04:20" onChange={(e) => setInput(e.target.value)} style={{ padding: '10px', width: '100px' }} />
          <button onClick={validateClock} style={{ display: 'block', marginTop: '10px' }}>AYARLA</button>
        </div>
      )}

      {step === 2 && (
        <div className="paper-note">
          <h3>Tozlu Defter</h3>
          <p>Gizli bölmeden bir defter çıktı!</p>
          <p>İsim: <strong>AURELIUS</strong></p>
          <button onClick={() => sendClue('text', 'AURELIUS')} style={{ marginTop: '10px' }}>İSMİ GELECEĞE GÖNDER</button>
        </div>
      )}

      {step === 3 && (
        <div className="paper-note">
          <h3>Kilitli Kasa</h3>
          <p>Kasanın şifresini gir (Gelecekten ipucu bekle):</p>
          <input type="text" placeholder="Şifre" onChange={(e) => setInput(e.target.value)} />
          <button onClick={validateSafe} style={{ display: 'block', marginTop: '10px' }}>KASAYI AÇ</button>
        </div>
      )}

      {step === 4 && <div className="success-overlay"><h1>TEBRİKLER!</h1><p>Geçmiş ve Gelecek Birleşti.</p></div>}

      <div style={{ marginTop: '20px' }}>
        {incomingClues.map((c, i) => <div key={i} className="paper-note" style={{ background: '#e0fbfc', marginBottom: '10px' }}>{c.value}</div>)}
      </div>
    </div>
  );
};

const FutureWorkflow = ({ step, onNext, sendClue, incomingClues }) => {
  const [input, setInput] = useState('');

  return (
    <div className="game-view future">
      <h2>FAZ {step}</h2>
      
      {step === 1 && (
        <div className="terminal-window">
          <p>> Arşiv: Saat 04:20'ye ayarlanmalı.</p>
          <button onClick={() => sendClue('future-clue', 'Saati 04:20 yap!')}>İPUCU GÖNDER</button>
        </div>
      )}

      {step === 2 && (
        <div className="terminal-window">
          <p>> Veri kilitli. Mirasçı ismini girin:</p>
          <input type="text" onChange={(e) => setInput(e.target.value)} style={{ background: 'black', color: 'white', border: '1px solid #00f2ff' }} />
          <button onClick={() => input.toUpperCase().trim() === 'AURELIUS' && onNext(3)}>ONAYLA</button>
          <div style={{ marginTop: '20px' }}>
            <p>Geçmişten Gelen Sinyaller:</p>
            {incomingClues.filter(c => c.type === 'text').map((c, i) => <p key={i} style={{ color: '#ff00c1' }}>> {c.value}</p>)}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="terminal-window">
          <p>> Koordinatlar Çözüldü: 852</p>
          <button onClick={() => sendClue('future-clue', 'Kasa Şifresi: 852')}>ŞİFREYİ GÖNDER</button>
        </div>
      )}

      {step === 4 && <div className="success-overlay"><h1>GÖREV TAMAMLANDI!</h1></div>}
    </div>
  );
};

export default App;
