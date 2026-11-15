<?php
// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
declare(strict_types=1);

namespace LunarNav\Agent;

interface Provider
{
    /**
     * Runs a tool-use conversation to completion.
     *
     * @param list<array{name:string,description:string,schema:array}> $tools
     * @param callable(string,array):array $execute runs a tool and returns its result
     * @param list<array{role:string,content:string}> $history earlier turns (text only)
     * @return array{text:string, steps:int, model:string}
     */
    public function run(string $system, array $history, string $user, array $tools, callable $execute, int $maxSteps): array;
}
