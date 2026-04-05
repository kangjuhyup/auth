import { Logger } from '@nestjs/common';

/** 단위·E2E 테스트 중 Nest 기본 Logger 출력 비활성화 */
Logger.overrideLogger(false);
