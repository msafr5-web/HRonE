import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, Public } from '../../common/decorators';
import type { AuthUser } from '../../common/types';
import { UpdateProfileDto, VerificationRequestDto } from './users.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  // NOTE: static routes are declared before ':username' so they are not shadowed.
  @Patch('me')
  updateMe(@CurrentUser() u: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateMe(u.id, dto);
  }

  @Throttle({ default: { limit: 3, ttl: 3_600_000 } })
  @Post('me/verification')
  requestVerification(@CurrentUser() u: AuthUser, @Body() dto: VerificationRequestDto) {
    return this.users.requestVerification(u.id, dto);
  }

  @Public()
  @Get('directory')
  directory(@Query('q') q = '') {
    return this.users.directory(String(q).slice(0, 60));
  }

  @Get('search')
  search(@CurrentUser() u: AuthUser, @Query('q') q = '') {
    return this.users.search(String(q).slice(0, 50), u.id);
  }

  @Public()
  @Get(':username')
  profile(@Param('username') username: string, @CurrentUser() u?: AuthUser) {
    return this.users.profile(username, u?.id);
  }

  @Post(':username/follow')
  follow(@CurrentUser() u: AuthUser, @Param('username') username: string) {
    return this.users.follow(u.id, username);
  }

  @Post(':username/block')
  block(@CurrentUser() u: AuthUser, @Param('username') username: string) {
    return this.users.block(u.id, username);
  }

  @Delete(':username/block')
  unblock(@CurrentUser() u: AuthUser, @Param('username') username: string) {
    return this.users.unblock(u.id, username);
  }

  @Delete(':username/follow')
  unfollow(@CurrentUser() u: AuthUser, @Param('username') username: string) {
    return this.users.unfollow(u.id, username);
  }
}
