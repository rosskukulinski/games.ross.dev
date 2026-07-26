import { MountConfig } from '../entities/mounts/Mount'

export const MOUNTS: Record<string, MountConfig> = {
  'celestial-unicorn': {
    name: 'Celestial Unicorn',
    maxSpeed: 50,
    acceleration: 30,
    turnSpeed: 2.0,
    movementType: 'fly',
    color: 0xffffff,
    accent: 0xff9dd6
  },
  'storm-unicorn': {
    name: 'Storm Unicorn',
    maxSpeed: 70,
    acceleration: 40,
    turnSpeed: 1.5,
    movementType: 'fly',
    color: 0x8fb6e8,
    accent: 0x5ee6ff
  },
  'shadow-unicorn': {
    name: 'Shadow Unicorn',
    maxSpeed: 60,
    acceleration: 50,
    turnSpeed: 2.5,
    movementType: 'fly',
    color: 0x4a3d6b,
    accent: 0xc084ff
  },
  'meadow-pony': {
    name: 'Meadow Pony',
    maxSpeed: 30,
    acceleration: 20,
    turnSpeed: 3.0,
    movementType: 'float',
    color: 0xffb3d1,
    accent: 0xfff3b8
  }
}
