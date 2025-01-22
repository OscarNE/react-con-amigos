export interface Book {
    title: string;
    sanitizedTitle: string;
    novelUpdatesUrl: string;
    translationUrl: string;
    bookPath: string;
    coverImagePath: string;
    summary: string;
    genres: string[];
    tags: string[];
    nChapters: number;
    nfiles: number;
    lastChapter: number;
}

export type BookMap = Record<string, Book>;
