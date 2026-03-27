import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: { origin: true },
  namespace: '/',
})
export class ActivityGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private getRoomName(branchId: string): string {
    return `branch_${branchId}`;
  }

  private getCustomerRoomName(customerId: string): string {
    return `customer_${customerId}`;
  }

  handleConnection(client: { id: string; handshake: { query?: Record<string, string> }; join: (room: string) => void }) {
    const query = client.handshake?.query ?? {};
    const branchId = query.branchId as string | undefined;
    if (branchId) {
      client.join(this.getRoomName(branchId));
    }
    const customerId = query.customerId as string | undefined;
    if (customerId) {
      client.join(this.getCustomerRoomName(customerId));
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

  emitCheckinUpdated(branchId: string, payload: { id: string; status: string }): void {
    this.server.to(this.getRoomName(branchId)).emit('checkin_updated', payload);
  }

  emitCheckinUpdatedToCustomer(customerId: string, payload: { id: string; status: string }): void {
    this.server.to(this.getCustomerRoomName(customerId)).emit('checkin_updated', payload);
  }
}
