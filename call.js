/**
 * WebRTC Call Manager
 * Controls media streams, peer connections, and call state.
 */
class CallManager {
  constructor(pbxEngine) {
    this.pbx = pbxEngine;
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.currentRemoteExt = null;
    this.isMuted = false;
    this.isOnHold = false;
    
    // Default public STUN servers for NAT traversal
    this.iceConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };
  }

  // Initialize a new peer connection
  _initPeerConnection(remoteExt) {
    this.peerConnection = new RTCPeerConnection(this.iceConfig);
    this.currentRemoteExt = remoteExt;

    // Send local ICE candidates to the remote peer
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.pbx.sendSignal(remoteExt, {
          type: 'candidate',
          candidate: event.candidate
        });
      }
    };

    // Attach incoming audio stream to remote audio element
    this.peerConnection.ontrack = (event) => {
      this.remoteStream = event.streams[0];
      const audioElem = document.getElementById('remoteAudio');
      if (audioElem) {
        audioElem.srcObject = this.remoteStream;
      }
    };
  }

  // Start an outgoing call to another extension
  async makeCall(targetExtension) {
    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    this._initPeerConnection(targetExtension);

    this.localStream.getTracks().forEach(track => {
      this.peerConnection.addTrack(track, this.localStream);
    });

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    await this.pbx.sendSignal(targetExtension, {
      type: 'offer',
      offer: offer
    });
  }

  // Answer an incoming call request
  async answerCall(fromExtension, offer) {
    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    this._initPeerConnection(fromExtension);

    this.localStream.getTracks().forEach(track => {
      this.peerConnection.addTrack(track, this.localStream);
    });

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    await this.pbx.sendSignal(fromExtension, {
      type: 'answer',
      answer: answer
    });
  }

  // Process incoming signaling messages
  async handleSignal(signal) {
    const { from, data } = signal;

    if (data.type === 'offer') {
      if (confirm(`Incoming call from Extension ${from}. Answer?`)) {
        await this.answerCall(from, data.offer);
      }
    } else if (data.type === 'answer') {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    } else if (data.type === 'candidate' && this.peerConnection) {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
  }

  // Toggle microphone mute
  toggleMute() {
    if (!this.localStream) return false;
    this.isMuted = !this.isMuted;
    this.localStream.getAudioTracks()[0].enabled = !this.isMuted;
    return this.isMuted;
  }

  // Toggle call hold
  toggleHold() {
    if (!this.peerConnection) return false;
    this.isOnHold = !this.isOnHold;
    this.peerConnection.getSenders().forEach(sender => {
      if (sender.track) {
        sender.track.enabled = !this.isOnHold;
      }
    });
    return this.isOnHold;
  }

  // Hang up active call
  endCall() {
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    this.isMuted = false;
    this.isOnHold = false;
  }
}
