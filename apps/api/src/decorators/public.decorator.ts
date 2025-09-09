import { SetMetadata } from '@nestjs/common';

// Public route decorator
export const Public = () => SetMetadata('isPublic', true);