package com.flic.automation.utils;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.Set;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.testng.Assert;

public final class ExcelUtils {
    private ExcelUtils() { }
    public static void assertReadable(Path path) {
        Assert.assertTrue(Files.isRegularFile(path) && size(path) > 0, "XLSX missing or empty: " + path);
        try (InputStream input=Files.newInputStream(path); Workbook workbook=WorkbookFactory.create(input)) {
            Assert.assertTrue(workbook.getNumberOfSheets()>0, "XLSX has no sheets");
            Assert.assertTrue(workbook.getSheetAt(0).getPhysicalNumberOfRows()>0, "XLSX has no rows");
        } catch (IOException error) { throw new AssertionError("Unreadable XLSX: " + path, error); }
    }
    public static void assertColumnsReadable(Path path) {
        assertReadable(path);
        try (InputStream input=Files.newInputStream(path); Workbook workbook=WorkbookFactory.create(input)) {
            Row header=workbook.getSheetAt(0).getRow(workbook.getSheetAt(0).getFirstRowNum());
            Assert.assertNotNull(header, "Missing XLSX header");
            Set<String> names=new HashSet<>(); for(Cell cell:header) { String value=cell.toString().trim(); Assert.assertFalse(value.isBlank()); Assert.assertTrue(names.add(value), "Duplicate XLSX header: "+value); }
        } catch (IOException error) { throw new AssertionError(error); }
    }
    public static void assertContainsAppliedFilterMetadata(Path path, String filter) {
        assertReadable(path);
        try (InputStream input=Files.newInputStream(path); Workbook workbook=WorkbookFactory.create(input)) {
            boolean found=false; for(var sheet:workbook){ for(Row row:sheet){ for(Cell cell:row){ if(cell.toString().contains(filter)){found=true;break;} } if(found)break;} if(found)break; }
            Assert.assertTrue(found, "Applied filter metadata not found in XLSX: " + filter);
        } catch(IOException error){throw new AssertionError(error);}
    }
    private static long size(Path path){try{return Files.size(path);}catch(IOException error){return 0;}}
}
