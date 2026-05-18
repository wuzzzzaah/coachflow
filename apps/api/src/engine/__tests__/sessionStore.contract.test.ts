import { sessionStoreContract } from '@coachflow/shared/src/contracts';
import { InMemorySessionStore } from '../inMemorySessionStore';

sessionStoreContract(() => new InMemorySessionStore());
