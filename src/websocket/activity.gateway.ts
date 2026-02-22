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

  private getCustomerRoomName(customerId: string): string {
    return `customer_${customerId}`;
  }

  private normalizeQueryParam(value: unknown): string | null {
    if (value == null) return null;
    const s = Array.isArray(value) ? value[0] : value;
    const str = typeof s === 'string' ? s.trim() : String(s).trim();
    return str || null;
  }

  handleConnection(client: { id: string; handshake: { query?: Record<string, unknown> }; join: (room: string) => void }) {
    const query = client.handshake?.query ?? {};
    const branchId = this.normalizeQueryParam(query.branchId);
    if (branchId) {
      client.join(this.getRoomName(branchId));
    }
    const customerId = this.normalizeQueryParam(query.customerId);
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
    const normalized = typeof customerId === 'string' ? customerId.trim() : String(customerId).trim();
    if (normalized) {
      this.server.to(this.getCustomerRoomName(normalized)).emit('checkin_updated', payload);
    }
  }
}
