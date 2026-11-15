<?php
// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
declare(strict_types=1);

namespace LunarNav\Http;

use RuntimeException;

/**
 * An error the user should see as a polite message: it carries a stable code that the
 * front-end translates (en/es/pt), an English message, and the HTTP status.
 */
final class ApiError extends RuntimeException
{
    public function __construct(public readonly string $errorCode, string $message, public readonly int $status = 400)
    {
        parent::__construct($message);
    }
}
