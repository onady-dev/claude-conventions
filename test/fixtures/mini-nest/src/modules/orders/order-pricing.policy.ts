import type { Order } from '../../entities/order.entity';

// Date.now() 는 여기서 쓰지 않는다 (주석은 검사 대상이 아니다)
const LABEL = 'new Date() 는 문자열이라 검사 대상이 아니다';

export function totalWithTax(order: Order, rate: number): number {
  return Math.round(order.amount * (1 + rate));
}

export const TAX_LABEL = LABEL;
