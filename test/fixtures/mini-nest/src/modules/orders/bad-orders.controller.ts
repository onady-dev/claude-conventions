import { Controller, Get } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../../entities/order.entity';

@Controller('api/legacy-orders')
export class BadOrdersController {
  constructor(
    @InjectRepository(Order)
    private readonly repo: Repository<Order>,
  ) {}

  @Get()
  async list() {
    const rows = await this.repo.find();
    const result = [];
    for (const row of rows) {
      if (row.status === 'PAID') {
        result.push({ id: row.id, label: '결제 완료' });
      } else if (row.status === 'CANCELLED') {
        result.push({ id: row.id, label: '취소' });
      } else if (row.status === 'REFUNDED') {
        result.push({ id: row.id, label: '환불' });
      } else {
        result.push({ id: row.id, label: '대기' });
      }
    }
    const total = result.length;
    const paid = result.filter((r) => r.label === '결제 완료').length;
    const ratio = total === 0 ? 0 : paid / total;
    return { total, paid, ratio, result };
  }
}
