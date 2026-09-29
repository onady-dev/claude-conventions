import { Injectable } from '@nestjs/common';
import { Order } from '../../entities/order.entity';
import { OrdersService } from './orders.service';

export type ExpiryDeps = { service: OrdersService; marker: typeof Injectable };

export function isExpired(order: Order, createdAtMs: number): boolean {
  return order.status === 'NEW' && Date.now() - createdAtMs > 86_400_000;
}
