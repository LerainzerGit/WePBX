/**
 * Browser PBX Engine using PeerJS
 * Includes free TURN/STUN relays and status logging.
 */
class BrowserPBX {
  constructor() {
    this.peer = null;
    this.currentExtension = null;
    this.onIncomingCallHandler = null;
  }

  // Register an extension ID on the PeerJS signaling network
  register(extensionNumber, onReady) {
    const cleanExt = extensionNumber.toString().trim();
    this.currentExtension = cleanExt;
    const peerId = `pbx-ext-${cleanExt}`;

    console.log(`[PBX] Registering extension: ${cleanExt} (Peer ID: ${peerId})`);

    // PeerJS configuration with STUN & free public TURN relay servers
    this.peer = new Peer(peerId, {
      debug: 2, // Log errors and warnings
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
          },
          {
            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          }
        ]
      }
    });

    this.peer.on('open', (id) => {
      console.log(`[PBX] Successfully connected to signaling server as: ${id}`);
      if (onReady) onReady(id);
    });

    // Listen for incoming calls
    this.peer.on('call', (mediaConnection) => {
      const callerId = mediaConnection.peer.replace('pbx-ext-', '');
      console.log(`[PBX] Incoming call detected from Extension: ${callerId}`);
      if (this.onIncomingCallHandler) {
        this.onIncomingCallHandler(mediaConnection);
      }
    });

    this.peer.on('disconnected', () => {
      console.warn('[PBX] Peer disconnected from signaling server. Attempting reconnect...');
      this.peer.reconnect();
    });

    this.peer.on('error', (err) => {
      console.error('[PBX Engine Error]', err);
      if (err.type === 'unavailable-id') {
        alert(`Extension ${cleanExt} is already online on another browser tab/device.`);
      } else if (err.type === 'peer-unavailable') {
        alert(`Extension is unreachable. Make sure the target extension is online.`);
      } else {
        alert(`PBX Connection Error: ${err.type}`);
      }
    });
  }

  // Set callback for incoming call handler
  onIncomingCall(handler) {
    this.onIncomingCallHandler = handler;
  }
}
