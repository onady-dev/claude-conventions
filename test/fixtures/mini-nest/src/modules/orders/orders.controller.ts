import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService } from './orders.service';

@Controller('api/orders')
@UseGuards(AuthGuard)
export class OrdersController {
  constructor(private readonly svc: OrdersService) {}

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.svc.getOne(id);
  }

  @Post()
  create(@Body() dto: CreateOrderDto) {
    return this.svc.create(dto);
  }
}
