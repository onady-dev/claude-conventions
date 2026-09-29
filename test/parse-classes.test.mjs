import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSource } from '../lib/parse.mjs';

const CONTROLLER = `
@Controller('api/items')
@UseGuards(AuthGuard)
export class ItemsController {
  constructor(
    private readonly svc: ItemsService,
    @InjectRepository(Item) private readonly repo: Repository<Item>,
  ) {}

  @Get(':id')
  @Roles('ADMIN')
  async getOne(@Param('id') id: string): Promise<{ id: string }> {
    const x = { a: 1 };
    return this.svc.getOne(id, x);
  }

  private helper(a: number, b = 2): number { return a + b; }

  static create(): ItemsController { return null as never; }
}
`;

const ENTITY = `
@Entity('items')
export class Item {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'varchar', length: 20 })
  name!: string;
  note?: string;
  #secret = 'x';
}
`;

const MODULE = `
@Module({
  imports: [
    // 주석
    TypeOrmModule.forFeature([A, B]),
    AuthModule,
    forwardRef(() => OtherModule),
    ThrottlerModule.forRoot({ imports: [X] }),
  ],
  controllers: [C1],
  providers: [S1, { provide: TOKEN, useClass: Impl }],
  exports: [S1],
})
export class FooModule {}
`;

test('클래스 데코레이터와 인자를 순서대로 뽑는다', () => {
  const [cls] = parseSource(CONTROLLER).classes;
  assert.equal(cls.name, 'ItemsController');
  assert.equal(cls.line, 4);
  assert.deepEqual(cls.decorators, [
    { name: 'Controller', args: "'api/items'" },
    { name: 'UseGuards', args: 'AuthGuard' },
  ]);
  assert.equal(cls.module, null);
});

test('생성자 파라미터의 이름·타입·데코레이터를 뽑는다', () => {
  const [cls] = parseSource(CONTROLLER).classes;
  assert.deepEqual(cls.ctor.params.map(({ name, type, decorators }) => ({ name, type, decorators })), [
    { name: 'svc', type: 'ItemsService', decorators: [] },
    { name: 'repo', type: 'Repository<Item>', decorators: [{ name: 'InjectRepository', args: 'Item' }] },
  ]);
  assert.deepEqual(cls.ctor.params[0].modifiers, ['private', 'readonly']);
});

test('메서드의 데코레이터·파라미터·가시성·본문 줄 수를 뽑는다', () => {
  const [cls] = parseSource(CONTROLLER).classes;
  const [getOne, helper, create] = cls.methods;
  assert.equal(cls.methods.length, 3);
  assert.deepEqual(getOne.decorators.map((d) => d.name), ['Get', 'Roles']);
  assert.deepEqual(getOne.params, ['id']);
  assert.equal(getOne.isAsync, true);
  assert.equal(getOne.visibility, 'public');
  assert.equal(getOne.bodyLines, 2);
  assert.equal(getOne.line, 12);
  assert.equal(helper.visibility, 'private');
  assert.deepEqual(helper.params, ['a', 'b']);
  assert.equal(helper.bodyLines, 0);
  assert.equal(create.isStatic, true);
});

test('속성의 이름·타입·데코레이터를 뽑는다', () => {
  const [cls] = parseSource(ENTITY).classes;
  assert.deepEqual(
    cls.props.map(({ name, type, optional, decorators }) => ({ name, type, optional, decorators: decorators.map((d) => d.name) })),
    [
      { name: 'id', type: 'number', optional: false, decorators: ['PrimaryGeneratedColumn'] },
      { name: 'name', type: 'string', optional: false, decorators: ['Column'] },
      { name: 'note', type: 'string', optional: true, decorators: [] },
      { name: '#secret', type: null, optional: false, decorators: [] },
    ],
  );
});

test('@Module 인자에서 imports·forFeature·providers를 분리한다', () => {
  const [cls] = parseSource(MODULE).classes;
  assert.deepEqual(cls.module, {
    imports: ['AuthModule', 'OtherModule', 'ThrottlerModule'],
    providers: ['S1', 'provide:TOKEN'],
    controllers: ['C1'],
    exports: ['S1'],
    forFeature: ['A', 'B'],
  });
});

test('클래스 본문에서 해석하지 못한 줄은 unparsed로 드러낸다', () => {
  const parsed = parseSource('export class A {\n  [key: string]: unknown;\n  ok(): void {}\n}\n');
  assert.deepEqual(parsed.unparsed, [{ line: 2, text: '[key: string]: unknown;' }]);
  assert.deepEqual(parsed.classes[0].methods.map((m) => m.name), ['ok']);
});

test('시간·랜덤 직접 호출을 찾되 주석과 문자열 안은 무시한다', () => {
  const src = "const a = Date.now();\nconst s = 'Math.random()'; // new Date()\nconst d = new Date(x);\nconst e = new Date();\n";
  assert.deepEqual(parseSource(src).impureCalls, [
    { call: 'Date.now()', line: 1 },
    { call: 'new Date()', line: 4 },
  ]);
});

test('문자열 안의 @와 class는 데코레이터·클래스로 보지 않는다', () => {
  const parsed = parseSource("const s = '@Injectable() export class Fake {}';\n");
  assert.deepEqual(parsed.classes, []);
});
test('데코레이터와 class가 같은 줄에 있어도 클래스를 뽑는다', () => {
  const [cls] = parseSource("@Injectable() export class S { bar() {} }\n").classes;
  assert.equal(cls.name, 'S');
  assert.deepEqual(cls.decorators, [{ name: 'Injectable', args: '' }]);
  assert.deepEqual(cls.methods.map((m) => m.name), ['bar']);
});
test('앞줄과 같은 줄의 데코레이터를 모두 클래스에 붙인다', () => {
  const [cls] = parseSource("@Controller('a')\n@UseGuards(G) export class C {}\n").classes;
  assert.deepEqual(cls.decorators.map((d) => d.name), ['Controller', 'UseGuards']);
});
