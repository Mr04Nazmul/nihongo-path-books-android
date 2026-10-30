package online.devnazu.books

import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter

/** PostgreSQL emits numeric offsets and fractional seconds, including +00:00. */
object ServerTime {
    fun millis(value: String): Long = OffsetDateTime.parse(value, DateTimeFormatter.ISO_OFFSET_DATE_TIME).toInstant().toEpochMilli()
}
