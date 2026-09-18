/**
 * Browser PBX Engine using PeerJS
 */
class BrowserPBX {
  constructor() {
    this.peer = null;
    this.currentExtension = null;
    this.displayName = 'Anonymous';
    this.onIncomingCallHandler = null;
  }

  register(extensionNumber, displayName, onReady) {
    const cleanExt = extensionNumber.toString().trim();
    this.currentExtension = cleanExt;
    this.displayName = displayName.toString().trim() || `Ext ${cleanExt}`;
    const peerId = `pbx-ext-${cleanExt}`;

    console.log(`[PBX] Registering extension: ${cleanExt} (${this.displayName})`);

    this.peer = new Peer(peerId, {
      debug: 2,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          },
          {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          }
        ]
      }
    });

    this.peer.on('open', (id) => {
      console.log(`[PBX] Connected to signaling server as: ${id}`);
      if (onReady) onReady(id);
    });

    this.peer.on('call', (mediaConnection) => {
      console.log(`[PBX] Incoming call received.`);
      if (this.onIncomingCallHandler) {
        this.onIncomingCallHandler(mediaConnection);
      }
    });

    this.peer.on('disconnected', () => {
      this.peer.reconnect();
    });

    this.peer.on('error', (err) => {
      console.error('[PBX Error]', err);
      if (err.type === 'unavailable-id') {
        alert(`Extension ${cleanExt} is already online on another browser/device.`);
      } else if (err.type === 'peer-unavailable') {
        alert(`Extension ${cleanExt} is unreachable or offline.`);
      } else {
        alert(`PBX Connection Error: ${err.type}`);
      }
    });
  }

  onIncomingCall(handler) {
    this.onIncomingCallHandler = handler;
  }
}
