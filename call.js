/**
 * WebRTC Call Manager
 * Controls media capture, active call state, stream rendering, timers, and UI indicators.
 */
class CallManager {
  constructor(pbxEngine) {
    this.pbx = pbxEngine;
    this.activeCall = null;
    this.localStream = null;
    this.isMuted = false;
    this.isOnHold = false;
    this.timerInterval = null;
    this.callSeconds = 0;
  }

  // Start an outgoing call
  async makeCall(targetExtension) {
    const cleanTarget = targetExtension.toString().trim();
    if (!cleanTarget) {
      alert('Please enter a valid target extension.');
      return;
    }

    if (!this.pbx.peer || this.pbx.peer.disconnected) {
      alert('PBX is offline. Please register your extension first.');
      return;
    }

    try {
      this._updateCallStatus(`Dialing Ext ${cleanTarget}...`, 'text-amber-400');
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      
      const targetPeerId = `pbx-ext-${cleanTarget}`;
      this.activeCall = this.pbx.peer.call(targetPeerId, this.localStream);

      if (!this.activeCall) {
        throw new Error('Failed to create outbound media connection.');
      }

      this._setupCallEvents(this.activeCall);
    } catch (err) {
      console.error('[CallManager Error]', err);
      alert(`Could not place call: ${err.message || 'Microphone permission denied.'}`);
      this.endCall();
    }
  }

  // Answer an incoming call
  async answerCall(incomingCall) {
    try {
      this._updateCallStatus('Connecting call...', 'text-amber-400');
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      
      this.activeCall = incomingCall;
      this.activeCall.answer(this.localStream);
      
      this._setupCallEvents(this.activeCall);
    } catch (err) {
      console.error('[CallManager Error]', err);
      alert(`Failed to answer call: ${err.message || 'Microphone permission denied.'}`);
      this.endCall();
    }
  }

  // Bind WebRTC connection events
  _setupCallEvents(call) {
    call.on('stream', (remoteStream) => {
      console.log('[CallManager] Remote audio stream received.');
      const audioElem = document.getElementById('remoteAudio');
      if (audioElem) {
        audioElem.srcObject = remoteStream;
        audioElem.play().catch(e => console.error('Audio playback error:', e));
      }
      
      this._updateCallStatus('Call Connected', 'text-emerald-400');
      this._startTimer();
    });

    call.on('close', () => {
      console.log('[CallManager] Call session ended by remote peer.');
      this.endCall();
    });

    call.on('error', (err) => {
      console.error('[CallManager Session Error]', err);
      alert(`Call Session Error: ${err.message || err}`);
      this.endCall();
    });
  }

  // Active call timer
  _startTimer() {
    this._stopTimer();
    this.callSeconds = 0;
    const timerElem = document.getElementById('call-timer');
    if (timerElem) timerElem.classList.remove('hidden');

    this.timerInterval = setInterval(() => {
      this.callSeconds++;
      const mins = String(Math.floor(this.callSeconds / 60)).padStart(2, '0');
      const secs = String(this.callSeconds % 60).padStart(2, '0');
      if (timerElem) {
        timerElem.innerText = `${mins}:${secs}`;
      }
    }, 1000);
  }

  _stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    const timerElem = document.getElementById('call-timer');
    if (timerElem) {
      timerElem.innerText = '00:00';
      timerElem.classList.add('hidden');
    }
  }

  // UI status banner helper
  _updateCallStatus(message, textClass) {
    const statusElem = document.getElementById('call-status');
    if (statusElem) {
      statusElem.innerText = message;
      statusElem.className = `text-sm font-semibold mb-2 ${textClass}`;
    }
  }

  // Toggle microphone mute
  toggleMute() {
    if (!this.localStream) return false;
    this.isMuted = !this.isMuted;
    this.localStream.getAudioTracks().forEach(track => {
      track.enabled = !this.isMuted;
    });
    
    if (this.isMuted) {
      this._updateCallStatus('Call Connected (Muted)', 'text-amber-400');
    } else {
      this._updateCallStatus('Call Connected', 'text-emerald-400');
    }
    return this.isMuted;
  }

  // Toggle call hold
  toggleHold() {
    if (!this.localStream) return false;
    this.isOnHold = !this.isOnHold;
    this.localStream.getAudioTracks().forEach(track => {
      track.enabled = !this.isOnHold;
    });

    if (this.isOnHold) {
      this._updateCallStatus('Call On Hold', 'text-amber-400');
    } else {
      this._updateCallStatus('Call Connected', 'text-emerald-400');
    }
    return this.isOnHold;
  }

  // Terminate active call and clean up resources
  endCall() {
    console.log('[CallManager] Cleaning up call state and media streams...');
    if (this.activeCall) {
      this.activeCall.close();
      this.activeCall = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    this.isMuted = false;
    this.isOnHold = false;
    this._stopTimer();
    this._updateCallStatus('Idle', 'text-slate-400');

    const muteBtn = document.getElementById('btn-mute');
    const holdBtn = document.getElementById('btn-hold');
    if (muteBtn) muteBtn.classList.remove('bg-amber-600');
    if (holdBtn) holdBtn.classList.remove('bg-amber-600');
  }
}
