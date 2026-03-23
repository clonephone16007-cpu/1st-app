import { useState, useEffect, useRef, useCallback } from 'react';

// Singleton AudioContext to avoid creating multiple contexts
let audioCtx = null;
const activeNodes = new Map();
let masterGain = null;

const initAudio = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.connect(audioCtx.destination);
    masterGain.gain.value = 0.5;
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
};

const createNoiseBuffer = (type = 'white') => {
  const bufferSize = audioCtx.sampleRate * 2;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const output = buffer.getChannelData(0);
  
  if (type === 'white') {
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
  } else if (type === 'brown') {
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = output[i];
      output[i] *= 3.5; // compensate for gain
    }
  }
  return buffer;
};

const generators = {
  rain: () => {
    const source = audioCtx.createBufferSource();
    source.buffer = createNoiseBuffer('white');
    source.loop = true;
    
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1200;
    filter.Q.value = 0.5;
    
    const gain = audioCtx.createGain();
    gain.gain.value = 0.5;
    
    const lfo = audioCtx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.3;
    const lfoGain = audioCtx.createGain();
    lfoGain.gain.value = 0.2;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    lfo.start();
    
    source.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    source.start();
    
    return { source, gain, lfo };
  },
  
  thunder: () => {
    const gain = audioCtx.createGain();
    gain.gain.value = 0;
    gain.connect(masterGain);
    
    const interval = setInterval(() => {
      const source = audioCtx.createBufferSource();
      source.buffer = createNoiseBuffer('brown');
      
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 60 + Math.random() * 40;
      
      const burstGain = audioCtx.createGain();
      burstGain.gain.setValueAtTime(0, audioCtx.currentTime);
      burstGain.gain.linearRampToValueAtTime(0.8, audioCtx.currentTime + 1);
      burstGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 3);
      
      source.connect(filter);
      filter.connect(burstGain);
      burstGain.connect(gain);
      
      source.start();
      source.stop(audioCtx.currentTime + 3);
    }, 8000 + Math.random() * 12000);
    
    return { interval, gain };
  },
  
  cafe: () => {
    const source = audioCtx.createBufferSource();
    source.buffer = createNoiseBuffer('brown');
    source.loop = true;
    
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 400;
    filter.Q.value = 0.2;
    
    const gain = audioCtx.createGain();
    gain.gain.value = 0.3;
    
    source.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    source.start();
    
    const interval = setInterval(() => {
      const osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 200 + Math.random() * 300;
      
      const burstGain = audioCtx.createGain();
      burstGain.gain.setValueAtTime(0, audioCtx.currentTime);
      burstGain.gain.linearRampToValueAtTime(0.05, audioCtx.currentTime + 0.1);
      burstGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      
      osc.connect(burstGain);
      burstGain.connect(gain);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.5);
    }, 2000 + Math.random() * 3000);
    
    return { source, gain, interval };
  },
  
  fireplace: () => {
    const source = audioCtx.createBufferSource();
    source.buffer = createNoiseBuffer('brown');
    source.loop = true;
    
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 200;
    
    const gain = audioCtx.createGain();
    gain.gain.value = 0.6;
    
    const lfo = audioCtx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.5;
    const lfoGain = audioCtx.createGain();
    lfoGain.gain.value = 0.3;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    lfo.start();
    
    source.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    source.start();
    
    return { source, gain, lfo };
  },
  
  ocean: () => {
    const source = audioCtx.createBufferSource();
    source.buffer = createNoiseBuffer('white');
    source.loop = true;
    
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 300;
    filter.Q.value = 0.1;
    
    const gain = audioCtx.createGain();
    gain.gain.value = 0.4;
    
    const lfo = audioCtx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.07;
    const lfoGain = audioCtx.createGain();
    lfoGain.gain.value = 0.3;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    lfo.start();
    
    source.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    source.start();
    
    return { source, gain, lfo };
  },
  
  forest: () => {
    const source = audioCtx.createBufferSource();
    source.buffer = createNoiseBuffer('white');
    source.loop = true;
    
    const filter1 = audioCtx.createBiquadFilter();
    filter1.type = 'bandpass';
    filter1.frequency.value = 600;
    filter1.Q.value = 0.5;
    
    const filter2 = audioCtx.createBiquadFilter();
    filter2.type = 'bandpass';
    filter2.frequency.value = 2000;
    filter2.Q.value = 0.5;
    
    const gain = audioCtx.createGain();
    gain.gain.value = 0.3;
    
    source.connect(filter1);
    source.connect(filter2);
    filter1.connect(gain);
    filter2.connect(gain);
    gain.connect(masterGain);
    source.start();
    
    const interval = setInterval(() => {
      const osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 800 + Math.random() * 1200;
      
      const burstGain = audioCtx.createGain();
      burstGain.gain.setValueAtTime(0, audioCtx.currentTime);
      burstGain.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.05);
      burstGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
      
      osc.connect(burstGain);
      burstGain.connect(gain);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.2);
    }, 5000 + Math.random() * 7000);
    
    return { source, gain, interval };
  },
  
  white: () => {
    const source = audioCtx.createBufferSource();
    source.buffer = createNoiseBuffer('white');
    source.loop = true;
    const gain = audioCtx.createGain();
    gain.gain.value = 0.1;
    source.connect(gain);
    gain.connect(masterGain);
    source.start();
    return { source, gain };
  },
  
  brown: () => {
    const source = audioCtx.createBufferSource();
    source.buffer = createNoiseBuffer('brown');
    source.loop = true;
    const gain = audioCtx.createGain();
    gain.gain.value = 0.3;
    source.connect(gain);
    gain.connect(masterGain);
    source.start();
    return { source, gain };
  },
  
  lofi: () => {
    const source = audioCtx.createBufferSource();
    source.buffer = createNoiseBuffer('brown');
    source.loop = true;
    
    const gain = audioCtx.createGain();
    gain.gain.value = 0.4;
    
    const lfo = audioCtx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 1; // 60bpm
    const lfoGain = audioCtx.createGain();
    lfoGain.gain.value = 0.2;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    lfo.start();
    
    source.connect(gain);
    gain.connect(masterGain);
    source.start();
    
    return { source, gain, lfo };
  },
  
  bells: () => {
    const gain = audioCtx.createGain();
    gain.gain.value = 0.4;
    gain.connect(masterGain);
    
    const interval = setInterval(() => {
      const osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 220 + Math.random() * 660;
      
      const burstGain = audioCtx.createGain();
      burstGain.gain.setValueAtTime(0, audioCtx.currentTime);
      burstGain.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.01);
      burstGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 2);
      
      osc.connect(burstGain);
      burstGain.connect(gain);
      osc.start();
      osc.stop(audioCtx.currentTime + 2);
    }, 3000 + Math.random() * 5000);
    
    return { interval, gain };
  },
  
  keyboard: () => {
    const gain = audioCtx.createGain();
    gain.gain.value = 0.3;
    gain.connect(masterGain);
    
    const interval = setInterval(() => {
      const source = audioCtx.createBufferSource();
      source.buffer = createNoiseBuffer('white');
      
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1000 + Math.random() * 2000;
      filter.Q.value = 1;
      
      const burstGain = audioCtx.createGain();
      burstGain.gain.setValueAtTime(0, audioCtx.currentTime);
      burstGain.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.01);
      burstGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
      
      source.connect(filter);
      filter.connect(burstGain);
      burstGain.connect(gain);
      
      source.start();
      source.stop(audioCtx.currentTime + 0.05);
    }, 300 + Math.random() * 1200);
    
    return { interval, gain };
  },
  
  library: () => {
    const source = audioCtx.createBufferSource();
    source.buffer = createNoiseBuffer('brown');
    source.loop = true;
    
    const gain = audioCtx.createGain();
    gain.gain.value = 0.1;
    
    source.connect(gain);
    gain.connect(masterGain);
    source.start();
    
    const interval = setInterval(() => {
      const rustle = audioCtx.createBufferSource();
      rustle.buffer = createNoiseBuffer('white');
      
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 1000;
      
      const burstGain = audioCtx.createGain();
      burstGain.gain.setValueAtTime(0, audioCtx.currentTime);
      burstGain.gain.linearRampToValueAtTime(0.05, audioCtx.currentTime + 0.1);
      burstGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      
      rustle.connect(filter);
      filter.connect(burstGain);
      burstGain.connect(gain);
      
      rustle.start();
      rustle.stop(audioCtx.currentTime + 0.5);
    }, 10000 + Math.random() * 20000);
    
    return { source, gain, interval };
  }
};

export function useAudio() {
  const [active, setActive] = useState({});
  const [volumes, setVolumes] = useState({});
  const [masterVol, setMasterVol] = useState(0.5);

  const play = useCallback((id) => {
    initAudio();
    if (activeNodes.has(id)) return;
    
    const node = generators[id]();
    if (volumes[id] !== undefined) {
      node.gain.gain.value = volumes[id];
    }
    activeNodes.set(id, node);
    setActive(prev => ({ ...prev, [id]: true }));
  }, [volumes]);

  const stop = useCallback((id) => {
    if (!activeNodes.has(id)) return;
    const node = activeNodes.get(id);
    
    if (node.source) node.source.stop();
    if (node.lfo) node.lfo.stop();
    if (node.interval) clearInterval(node.interval);
    if (node.gain) node.gain.disconnect();
    
    activeNodes.delete(id);
    setActive(prev => ({ ...prev, [id]: false }));
  }, []);

  const stopAll = useCallback(() => {
    activeNodes.forEach((_, id) => stop(id));
  }, [stop]);

  const setVolume = useCallback((id, vol) => {
    setVolumes(prev => ({ ...prev, [id]: vol }));
    if (activeNodes.has(id)) {
      activeNodes.get(id).gain.gain.value = vol;
    }
  }, []);

  const setMaster = useCallback((vol) => {
    setMasterVol(vol);
    if (masterGain) {
      masterGain.gain.value = vol;
    }
  }, []);

  const isPlaying = useCallback((id) => {
    return !!active[id];
  }, [active]);

  return { play, stop, stopAll, setVolume, setMaster, isPlaying, active, volumes, masterVol };
}
