# claude-conventions

여러 프로젝트에서 재사용하는 Claude Code용 클린 아키텍처 규칙과 스킬.

- **Rules** (`rules/clean-arch/`): AI가 코드를 쓸 때 따르는 작성 규칙. 규칙 ID `CA-*`
- **Skills** (`skills/`): 스크립트가 코드를 먼저 읽어 필요한 메타데이터만 JSON으로 요약한다
  - `context-pack`: 모듈 구조 요약(라우트, 의존, 엔티티 컬럼, 서비스 메서드)
  - `arch-scan`: 규칙 위반 검사(변경 파일 또는 전체)

스크립트는 Node 22 이상만 있으면 되고 npm 의존성이 없다.

## 설치

```bash
node install.mjs                    # ~/.claude 에 설치
node install.mjs --target <폴더>    # 다른 위치에 설치(검증용)
```

- 설치는 `~/.claude/rules/clean-arch/`, `~/.claude/skills/context-pack/`, `~/.claude/skills/arch-scan/`에 복사한다.
- 이 스크립트가 만든 폴더(`.installed-by-claude-conventions` 표식 있음)만 덮어쓴다. 같은 이름의 다른 폴더가 있으면 멈춘다.
- 표식이 있는 설치 폴더는 지우고 다시 만든다. 설치 폴더 안에 직접 추가한 파일은 사라진다.
- 규칙이나 스크립트를 고친 뒤에는 다시 설치해야 반영된다.

## 프로젝트 설정

`templates/arch.json`을 프로젝트의 `.claude/arch.json`으로 복사해 기본값과 다른 부분만 남긴다. 없으면 NestJS 기본값으로 동작한다.

## 개발

```bash
npm test
```

설계: `docs/specs/2026-09-29-clean-arch-rules-skills-design.md`
