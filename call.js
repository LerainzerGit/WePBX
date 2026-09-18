/**
 * WebRTC Call Manager with Screen Sharing Support
 */
class CallManager {
  constructor(pbxEngine) {
    this.pbx = pbxEngine;
    this.activeCall = null;
    this.localStream = null;
    this.screenStream = null;
    this.isMuted = false;
    this.isOnHold = false;
    this.isSharingScreen = false;
    this.timerInterval = null;
    this.callSeconds = 0;
  }

  async makeCall(targetExtension) {
    const cleanTarget = targetExtension ? targetExtension.toString().trim() : '';
    if (!cleanTarget) {
      alert('Please enter a target extension to call.');
      return;
    }

    if (!this.pbx.peer || this.pbx.peer.disconnected || this.pbx.peer.destroyed) {
      alert('PBX is offline. Please register your extension first.');
      return;
    }

    try {
      this._updateCallStatus(`Dialing Ext ${cleanTarget}...`, 'text-amber-400');
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

      const targetPeerId = `pbx-ext-${cleanTarget}`;
      const metadata = {
        callerName: this.pbx.displayName,
        callerExt: this.pbx.currentExtension
      };

      this.activeCall = this.pbx.peer.call(targetPeerId, this.localStream, { metadata });

      if (!this.activeCall) {
        throw new Error('Could not initialize outbound call session.');
      }

      this._setupCallEvents(this.activeCall);
    } catch (err) {
      console.error('[CallManager Error]', err);
      alert(`Could not place call: ${err.message || 'Microphone access denied.'}`);
      this.endCall();
    }
  }

  async answerCall(incomingCall) {
    try {
      const callerName = incomingCall.metadata?.callerName || 'Unknown Caller';
      this._updateCallStatus(`Connecting to ${callerName}...`, 'text-amber-400');

      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.activeCall = incomingCall;
      this.activeCall.answer(this.localStream);

      this._setupCallEvents(this.activeCall);
    } catch (err) {
      console.error('[CallManager Error]', err);
      alert(`Failed to answer call: ${err.message || 'Microphone access denied.'}`);
      this.endCall();
    }
  }

  _setupCallEvents(call) {
    call.on('stream', (remoteStream) => {
      console.log('[CallManager] Remote stream received:', remoteStream.getTracks());

      const audioElem = document.getElementById('remoteAudio');
      const videoElem = document.getElementById('remoteVideo');

      // Check for video tracks in the stream
      const hasVideo = remoteStream.getVideoTracks().length > 0;

      if (hasVideo && videoElem) {
        videoElem.srcObject = remoteStream;
        videoElem.classList.remove('hidden');
        videoElem.play().catch(e => console.error('Video playback error:', e));
      }

      if (audioElem && remoteStream.getAudioTracks().length > 0) {
        audioElem.srcObject = remoteStream;
        audioElem.play().catch(e => console.error('Audio playback error:', e));
      }

      const callerName = call.metadata?.callerName || 'Peer';
      this._updateCallStatus(`Connected with ${callerName}`, 'text-emerald-400');
      this._startTimer();
    });

    call.on('close', () => {
      this.endCall();
    });

    call.on('error', (err) => {
      console.error('[CallManager Call Error]', err);
      this.endCall();
    });
  }

  async toggleScreenShare() {
    if (!this.activeCall) {
      alert('You must be in an active call to share your screen.');
      return;
    }

    try {
      if (!this.isSharingScreen) {
        // Capture display stream
        this.screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' },
          audio: false
        });

        const screenVideoTrack = this.screenStream.getVideoTracks()[0];
        const peerConnection = this.activeCall.peerConnection;

        if (peerConnection) {
          // Replace or add video track to WebRTC sender
          const senders = peerConnection.getSenders();
          const videoSender = senders.find(s => s.track && s.track.kind === 'video');

          if (videoSender) {
            await videoSender.replaceTrack(screenVideoTrack);
          } else {
            peerConnection.addTrack(screenVideoTrack, this.screenStream);
          }
        }

        this.isSharingScreen = true;
        this._updateCallStatus('Sharing Screen...', 'text-indigo-400');

        // Automatically revert when the user clicks browser "Stop sharing" bar
        screenVideoTrack.onended = () => {
          this.stopScreenShare();
        };
      } else {
        this.stopScreenShare();
      }
    } catch (err) {
      console.error('[Screen Share Error]', err);
    }
  }

  async stopScreenShare() {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
    }

    const peerConnection = this.activeCall?.peerConnection;
    if (peerConnection) {
      const senders = peerConnection.getSenders();
      const videoSender = senders.find(s => s.track && s.track.kind === 'video');
      if (videoSender) {
        peerConnection.removeTrack(videoSender);
      }
    }

    this.isSharingScreen = false;
    this._updateCallStatus('Call Connected', 'text-emerald-400');

    const screenBtn = document.getElementById('btn-screen');
    if (screenBtn) screenBtn.classList.remove('bg-indigo-600');
  }

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

  _updateCallStatus(message, textClass) {
    const statusElem = document.getElementById('call-status');
    if (statusElem) {
      statusElem.innerText = message;
      statusElem.className = `text-sm font-semibold mb-2 ${textClass}`;
    }
  }

  toggleMute() {
    if (!this.localStream) return false;
    this.isMuted = !this.isMuted;
    this.localStream.getAudioTracks().forEach(track => {
      track.enabled = !this.isMuted;
    });

    this._updateCallStatus(this.isMuted ? 'Call Connected (Muted)' : 'Call Connected', 'text-amber-400');
    return this.isMuted;
  }

  toggleHold() {
    if (!this.localStream) return false;
    this.isOnHold = !this.isOnHold;
    this.localStream.getAudioTracks().forEach(track => {
      track.enabled = !this.isOnHold;
    });

    this._updateCallStatus(this.isOnHold ? 'Call On Hold' : 'Call Connected', 'text-amber-400');
    return this.isOnHold;
  }

  endCall() {
    if (this.activeCall) {
      this.activeCall.close();
      this.activeCall = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
    }

    this.isMuted = false;
    this.isOnHold = false;
    this.isSharingScreen = false;
    this._stopTimer();
    this._updateCallStatus('Idle', 'text-slate-400');

    const videoElem = document.getElementById('remoteVideo');
    if (videoElem) {
      videoElem.srcObject = null;
      videoElem.classList.add('hidden');
    }

    const muteBtn = document.getElementById('btn-mute');
    const holdBtn = document.getElementById('btn-hold');
    const screenBtn = document.getElementById('btn-screen');
    if (muteBtn) muteBtn.classList.remove('bg-amber-600');
    if (holdBtn) holdBtn.classList.remove('bg-amber-600');
    if (screenBtn) screenBtn.classList.remove('bg-indigo-600');
  }
}
