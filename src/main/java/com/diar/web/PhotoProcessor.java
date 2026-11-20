package com.diar.web;

import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import javax.imageio.*;
import javax.imageio.stream.ImageInputStream;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.*;

@Component
public class PhotoProcessor {
    public byte[] jpeg(MultipartFile file) {
        if (file==null || file.isEmpty()) return null;
        if (file.getSize()>5*1024*1024) throw new ApiProblem(400,"photo_too_large");
        try (ImageInputStream stream=ImageIO.createImageInputStream(file.getInputStream())) {
            var readers=ImageIO.getImageReaders(stream);
            if (!readers.hasNext()) throw new ApiProblem(400,"invalid_photo");
            var reader=readers.next();
            try {
                reader.setInput(stream);
                int width=reader.getWidth(0), height=reader.getHeight(0);
                if (width<1 || height<1 || (long)width*height>20000000) throw new ApiProblem(400,"photo_too_large");
                BufferedImage source=reader.read(0);
                double scale=Math.min(1.0,1600.0/Math.max(width,height));
                var output=new BufferedImage(Math.max(1,(int)(width*scale)),Math.max(1,(int)(height*scale)),BufferedImage.TYPE_INT_RGB);
                Graphics2D graphics=output.createGraphics();
                graphics.setColor(Color.WHITE); graphics.fillRect(0,0,output.getWidth(),output.getHeight());
                graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION,RenderingHints.VALUE_INTERPOLATION_BICUBIC);
                graphics.drawImage(source,0,0,output.getWidth(),output.getHeight(),null); graphics.dispose();
                var bytes=new ByteArrayOutputStream(); ImageIO.write(output,"jpg",bytes); return bytes.toByteArray();
            } finally { reader.dispose(); }
        } catch (ApiProblem problem) { throw problem; }
        catch (Exception failure) { throw new ApiProblem(400,"invalid_photo"); }
    }
}
