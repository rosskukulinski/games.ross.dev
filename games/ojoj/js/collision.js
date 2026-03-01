class CollisionSystem {
    // Axis-Aligned Bounding Box collision
    static checkAABB(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width &&
               rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height &&
               rect1.y + rect1.height > rect2.y;
    }

    // Circle to Rectangle collision
    static checkCircleRect(circle, rect) {
        const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width));
        const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height));

        const distanceX = circle.x - closestX;
        const distanceY = circle.y - closestY;
        const distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);

        return distanceSquared < (circle.radius * circle.radius);
    }

    // Check if player is in fan's wind zone
    static checkWindZone(fan, playerBounds) {
        const windZone = {
            x: fan.x - fan.windRange,
            y: fan.y,
            width: fan.windRange,
            height: fan.height
        };
        return this.checkAABB(windZone, playerBounds);
    }

    // Check if player hit a ramp
    static checkRampCollision(ramp, playerBounds) {
        if (this.checkAABB(ramp.getBounds(), playerBounds)) {
            const relativeX = (playerBounds.x + playerBounds.width / 2) - ramp.x;
            const rampProgress = relativeX / ramp.width;

            if (rampProgress >= 0.7 && rampProgress <= 1) {
                return { hit: true, rampProgress: rampProgress };
            }
        }
        return { hit: false };
    }
}
