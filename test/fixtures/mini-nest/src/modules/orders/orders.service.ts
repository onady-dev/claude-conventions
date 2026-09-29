import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../../entities/order.entity';
import {
  PAYMENT_GATEWAY,
  type PaymentGateway,
} from '../payments/payment-gateway.port';
import { CreateOrderDto } from './dto/create-order.dto';
import { totalWithTax } from './order-pricing.policy';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private readonly repo: Repository<Order>,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {}

  async getOne(id: string): Promise<Order | null> {
    return this.repo.findOneBy({ id: Number(id) });
  }

  async create(dto: CreateOrderDto): Promise<{ id: number; chargeId: string }> {
    const order = await this.repo.save({ status: 'NEW', amount: dto.qty * 1000 });
    const chargeId = await this.gateway.charge(totalWithTax(order, 0.1));
    return { id: order.id, chargeId };
  }

  private audit(message: string): void {
    this.log.push(message);
  }

  private readonly log: string[] = [];
}
