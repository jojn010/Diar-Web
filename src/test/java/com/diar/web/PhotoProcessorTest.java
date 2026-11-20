package com.diar.web;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.*;
import static org.junit.jupiter.api.Assertions.*;

class PhotoProcessorTest {
    @Test void actualImageIsDecodedResizedAndConvertedToJpeg() throws Exception {
        var bytes=new ByteArrayOutputStream();ImageIO.write(new BufferedImage(2000,1000,BufferedImage.TYPE_INT_ARGB),"png",bytes);
        var result=new PhotoProcessor().jpeg(new MockMultipartFile("photo","home.png","image/png",bytes.toByteArray()));
        var decoded=ImageIO.read(new ByteArrayInputStream(result));
        assertEquals(1600,decoded.getWidth());assertEquals(800,decoded.getHeight());assertEquals(0xff,result[0]&255);assertEquals(0xd8,result[1]&255);
    }
    @Test void disguisedHtmlAndOversizeFilesAreRejected() {
        var processor=new PhotoProcessor();
        assertThrows(ApiProblem.class,()->processor.jpeg(new MockMultipartFile("photo","home.jpg","image/jpeg","<script>bad</script>".getBytes())));
        assertThrows(ApiProblem.class,()->processor.jpeg(new MockMultipartFile("photo","home.jpg","image/jpeg",new byte[5*1024*1024+1])));
    }
}
