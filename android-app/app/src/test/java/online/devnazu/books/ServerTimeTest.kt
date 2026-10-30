package online.devnazu.books
import org.junit.Test
import org.junit.Assert.*
class ServerTimeTest {
 @Test fun postgresAndUtcRepresentTheSameInstant(){
  val expected=1793284149257L
  assertEquals(expected,ServerTime.millis("2026-10-29T14:29:09.25706+00:00"))
  assertEquals(expected,ServerTime.millis("2026-10-29T14:29:09.257060Z"))
  assertEquals(expected,ServerTime.millis("2026-10-29T23:29:09.25706+09:00"))
 }
 @Test fun malformedClockIsRejected(){
  for(value in listOf("","null","2026-10-29","not-a-date"))assertTrue(runCatching{ServerTime.millis(value)}.isFailure)
 }
}
