package online.devnazu.books
import org.junit.Test
import org.junit.Assert.*
class AccessTest {
 @Test fun strictReaderOrigin(){assertTrue(Access.internal("https://appassets.androidplatform.net/assets/reader/n5.html"));listOf("https://evil.example/n5.html","https://appassets.androidplatform.net.evil.example/assets/reader/n5.html","http://appassets.androidplatform.net/assets/reader/n5.html","file:///etc/passwd","https://appassets.androidplatform.net/assets/reader/../secret","https://appassets.androidplatform.net:444/assets/reader/n5.html").forEach{assertFalse(it,Access.internal(it))}}
 @Test fun exactInitialCosts(){assertEquals(listOf(2,5,10,20),Access.thresholds["N5"]);assertNull(Access.thresholds["N1"]);assertEquals(4,Access.thresholds.size);assertFalse(Access.levels.contains("N1"))}
 @Test fun expiredAccessNeverNegative(){assertEquals(0L,Access.remaining(100,101));assertEquals(50L,Access.remaining(150,100))}
}
