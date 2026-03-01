import { MountConfig } from '../entities/mounts/Mount'

export const MOUNTS: Record<string, MountConfig> = {
  'celestial-unicorn': {
    name: 'Celestial Unicorn',
    maxSpeed: 50,
    acceleration: 30,
    turnSpeed: 2.0,
    movementType: 'fly',
    color: 0xffffff
  },
  'storm-unicorn': {
    name: 'Storm Unicorn',
    maxSpeed: 70,
    acceleration: 40,
    turnSpeed: 1.5,
    movementType: 'fly',
    color: 0x4477aa
  },
  'shadow-unicorn': {
    name: 'Shadow Unicorn',
    maxSpeed: 60,
    acceleration: 50,
    turnSpeed: 2.5,
    movementType: 'fly',
    color: 0x332244
  },
  'meadow-pony': {
    name: 'Meadow Pony',
    maxSpeed: 30,
    acceleration: 20,
    turnSpeed: 3.0,
    movementType: 'float',
    color: 0xffaacc
  }
}
