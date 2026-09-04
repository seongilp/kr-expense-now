'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Search } from 'lucide-react';

import { searchEntities } from '@/lib/rank';
import { TYPE_LABEL, sidoOf } from '@/lib/sido';
import type { Entity } from '@/lib/types';

/** 지자체명 검색. 243곳뿐이라 브라우저 메모리에서 includes 로 충분. 결과는 상세로 바로 간다. */
export function SearchBox({ entities }: { entities: readonly Entity[] }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const hits = open ? searchEntities(entities, q) : [];
  return (
    <div className="relative">
      <label className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm focus-within:border-primary">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)} // 클릭이 먼저 처리되게 살짝 늦춘다
          placeholder="지자체 이름 검색 (예: 고양시, 강남구)"
          className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
          aria-label="지자체 검색"
        />
      </label>
      {hits.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-border bg-popover py-1 shadow-lg">
          {hits.map((e) => (
            <li key={e.code}>
              <Link href={`/g/${e.code}`} className="flex items-baseline justify-between px-3 py-1.5 text-sm hover:bg-muted">
                <span className="font-medium">{e.name}</span>
                <span className="text-xs text-muted-foreground">
                  {e.type === 'metro' ? TYPE_LABEL.metro : `${sidoOf(e.sido)?.short ?? ''} · ${TYPE_LABEL[e.type]}`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {open && q.trim() && hits.length === 0 && (
        <p className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-popover px-3 py-2 text-xs text-muted-foreground shadow-lg">
          일치하는 지자체가 없습니다.
        </p>
      )}
    </div>
  );
}
