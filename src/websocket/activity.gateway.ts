import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/',
})
export class ActivityGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private getRoomName(branchId: string): string {
    return `branch_${branchId}`;
  }

  handleConnection(client: { id: string; handshake: { query?: Record<string, string> }; join: (room: string) => void }) {
    const branchId = client.handshake?.query?.branchId;
    if (branchId) {
      client.join(this.getRoomName(branchId));
    }
  }

  handleDisconnect() {}

  @SubscribeMessage('join_branch')
  handleJoinBranch(
    client: { join: (room: string) => void },
    payload: { branchId: string },
  ) {
    if (payload?.branchId) {
      client.join(this.getRoomName(payload.branchId));
    }
  }

  emitNewCheckInRequest(branchId: string, payload: unknown): void {
    this.server.to(this.getRoomName(branchId)).emit('new_checkin_request', payload);
  }
}
