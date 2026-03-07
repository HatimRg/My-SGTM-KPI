<?php

namespace App\Services;

class CommunityModerationService
{
    public static function normalize(string $text): string
    {
        $value = mb_strtolower($text, 'UTF-8');
        $value = preg_replace('/[\x{064B}-\x{065F}\x{0670}\x{06D6}-\x{06ED}\x{0640}]/u', '', $value) ?? $value;
        $value = str_replace(['’', '‘', '`', '´', '“', '”'], ["'", "'", "'", "'", '"', '"'], $value);
        $value = preg_replace('/\s+/u', ' ', trim($value)) ?? $value;

        $trans = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
        if ($trans !== false) {
            $value = mb_strtolower($trans, 'UTF-8');
        }

        return $value;
    }

    public static function detectBlockedTerms(string $text): array
    {
        $terms = config('community_feed.blocked_terms', []);
        $raw = mb_strtolower($text, 'UTF-8');
        $normalized = self::normalize($text);
        $collapsed = preg_replace('/[^\p{L}\p{N}]+/u', '', $normalized) ?? $normalized;

        $found = [];
        foreach ($terms as $term) {
            $termRaw = mb_strtolower((string) $term, 'UTF-8');
            $termNormalized = self::normalize($termRaw);
            $termCollapsed = preg_replace('/[^\p{L}\p{N}]+/u', '', $termNormalized) ?? $termNormalized;
            if ($termCollapsed === '') {
                continue;
            }

            if (str_contains($collapsed, $termCollapsed) || preg_match(self::buildRegex($termRaw), $raw)) {
                $found[] = $term;
            }
        }

        return array_values(array_unique($found));
    }

    private static function buildRegex(string $term): string
    {
        $chars = preg_split('//u', self::normalize($term), -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $leet = [
            'a' => '[a4@àáâäãå]',
            'b' => '[b8]',
            'c' => '[cç<]',
            'e' => '[e3éèêë]',
            'f' => '[fƒph]',
            'g' => '[g69]',
            'h' => '[h#]',
            'i' => '[i1!|lïîíì]',
            'k' => '[kq]',
            'l' => '[l1|!]',
            'o' => '[o0öôóòø]',
            's' => '[s5$z]',
            't' => '[t7+]',
            'u' => '[uuvvüûúù]',
            'v' => '[vuy]',
            'x' => '[x%*]',
        ];

        $pattern = [];
        foreach ($chars as $ch) {
            if (isset($leet[$ch])) {
                $pattern[] = $leet[$ch];
            } elseif (preg_match('/[\p{L}\p{N}]/u', $ch)) {
                $pattern[] = preg_quote($ch, '/');
            }
        }

        if (empty($pattern)) {
            return '/$^/u';
        }

        return '/(?<!\p{L})' . implode('[\W_]*', $pattern) . '(?!\p{L})/u';
    }
}
